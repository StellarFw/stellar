import { GenericServer } from "../generic-server";
import { LogLevel } from "../log-level.enum";
import ConnectionDetails from "../connection-details";
import { EROFS } from "constants";
import { Stream } from "stream";
import { Server, Socket, createServer } from "net";
import { createServer as createSecureServer } from "tls";
import Connection from "../connection";

export default class TCPServer extends GenericServer {
  protected static serverName: string = "TCP";

  /**
   * TCP server object.
   */
  private server: Server = null;

  constructor(api, options) {
    super(api, "tcp", options);
    this.attributes = {
      canChat: true,
      logConnections: true,
      logExits: true,
      pendingShutdownWaitLimit: 5000,
      sendWelcomeMessage: true,
      verbs: [
        "quit",
        "exit",
        "paramAdd",
        "paramDelete",
        "paramView",
        "paramsView",
        "paramsDelete",
        "roomJoin",
        "roomLeave",
        "roomView",
        "detailsView",
        "say",
        "event",
      ],
    };
    this.defineEvents();
  }

  /**
   * Check if the chunk contains the break chars.
   *
   * @param chunk Chunk to the analysed.
   */
  private checkBreakChars(chunk: any) {
    let found = false;
    const hexChunk = chunk.toString("hex", 0, chunk.length);

    if (hexChunk === "fff4fffd06") {
      found = true; // CTRL + C
    } else if (hexChunk === "04") {
      found = true; // CTRL + D
    }

    return found;
  }

  /**
   * Parse client request.
   *
   * @param connection Client connection object.
   * @param line Request line to be parsed.
   */
  private parseRequest(connection, line) {
    const words = line.split(" ");

    // get the request verb
    const verb = words.shift();

    if (verb === "file") {
      if (words.length > 0) {
        connection.params.file = words[0];
      }
      this.processFile(connection);
      return;
    }

    connection.verbs(verb, words, (error, data) => {
      // send an success response message, when there is no errors
      if (!error) {
        this.sendMessage(connection, {
          status: "OK",
          context: "response",
          data,
        });
        return;
      }

      if (error.code && error.code.match("014")) {
        // Error: Verb not found or not allowed
        // check for and attempt to check single-use params
        try {
          // parse JSON request
          const requestHash = JSON.parse(line);

          // pass all founded params to the connection object
          if (requestHash.params !== undefined) {
            connection.params = { ...requestHash.params };
          }

          // pass action name to the connection object, if exists
          if (requestHash.action) {
            connection.params.action = requestHash.action;
          }
        } catch (e) {
          connection.params.action = verb;
        }

        // reset some connection properties
        connection.error = null;
        connection.response = {};

        // process actions
        this.processAction(connection);
        return;
      }

      // send an error message
      this.sendMessage(connection, {
        status: error,
        context: "response",
        data,
      });
    });
  }

  private parseLine(connection, line) {
    // check the message length if the maxDataLength is active
    if (this.api.configs.servers.tcp.maxDataLength > 0) {
      const bufferLen = Buffer.byteLength(line, "utf8");

      if (bufferLen > this.api.configs.servers.tcp.maxDataLength) {
        const error = this.api.configs.errors.dataLengthTooLarge(
          this.api.configs.servers.tcp.maxDataLength,
          bufferLen,
        );
        this.log(error, LogLevel.Error);
        return this.sendMessage(connection, {
          status: "error",
          error,
          context: "response",
        });
      }
    }

    if (line.length > 0) {
      // increment at the start of the request so that responses can be caught in order
      // on the client, this is not handled by the genericServer
      connection.messageCount++;
      this.parseRequest(connection, line);
    }
  }

  private handleData(connection, chunk: Buffer) {
    if (this.checkBreakChars(chunk)) {
      connection.destroy();
    } else {
      connection.rawConnection.socketDataString += chunk
        .toString("utf-8")
        .replace(/\r/g, "\n");

      // get delimiter
      const delimiter = String(this.api.configs.servers.tcp.delimiter);

      let index = connection.rawConnection.socketDataString.indexOf(delimiter);

      while (index > -1) {
        const data = connection.rawConnection.socketDataString.slice(0, index);
        connection.rawConnection.socketDataString = connection.rawConnection.socketDataString.slice(
          index + delimiter.length,
        );
        data.split(delimiter).forEach(line => this.parseLine(connection, line));

        index = connection.rawConnection.socketDataString.indexOf(delimiter);
      }
    }
  }

  private handleEndEvent(connection) {
    // if the connection isn't destroyed do it now
    if (connection.destroyed !== true) {
      try {
        connection.rawConnection.end();
      } catch (e) {}
      connection.destroy();
    }
  }

  private handleEventError(connection, error) {
    if (connection.destroyed !== true) {
      this.log(`server error: ${error}`, LogLevel.Error);

      try {
        connection.rawConnection.end();
      } catch (e) {}
      connection.destroy();
    }
  }

  private handleConnectionEvent(connection) {
    connection.params = {};
    connection.rawConnection.on("data", data =>
      this.handleData(connection, data),
    );
    connection.rawConnection.on("end", () => this.handleEndEvent(connection));
    connection.rawConnection.on("error", error =>
      this.handleEventError(connection, error),
    );
  }

  /**
   * Send the action response to the client.
   *
   * @param data Action response
   */
  private handleActionCompleteEvent(data: any) {
    // TODO: implement a specific type for action response objects
    if (data.toRender === true) {
      data.response.context = "response";
      this.sendMessage(data.connection, data.response, data.messageCount);
    }
  }

  /**
   * Define global TCP events.
   */
  private defineEvents() {
    this.on("connection", this.handleConnectionEvent.bind(this));
    this.on("actionComplete", this.handleActionCompleteEvent.bind(this));
  }

  /**
   * Try a graceful shutdown.
   *
   * We will wait a while to Stellar try response to the pending connections.
   *
   * @param alreadyShutdown Informs of the server was already shutdown.
   */
  private innerStop(alreadyShutdown: boolean = false): Promise<void> {
    return new Promise(resolve => {
      // If the server isn't already shutdown do it now
      if (!alreadyShutdown) {
        this.server.close();
      }

      let pendingConnections = 0;

      // Finish all pending connections
      this.connections().forEach(connection => {
        if (connection.pendingActions === 0) {
          connection.destroy();
          return;
        }

        pendingConnections += 1;

        if (!connection.rawConnection.shutDownTimer) {
          connection.rawConnection.shutDownTimer = setTimeout(() => {
            connection.destroy();
          }, this.attributes.pendingShutdownWaitLimit);
        }
      });

      if (pendingConnections > 0) {
        this.log(
          `waiting on shutdown, there are still ${pendingConnections} connected clients waiting on a response`,
          LogLevel.Notice,
        );
        setTimeout(async () => {
          await this.innerStop(true);
          resolve();
        }, 1000);
      } else {
        resolve();
      }
    });
  }

  /**
   * Handle new connection.
   *
   * @param rawConnection Client raw connection object.
   */
  private handleConnection(rawConnection: Socket) {
    if (this.api.configs.servers.tcp.setKeepAlive === true) {
      rawConnection.setKeepAlive(true);
    }

    this.buildConnection({
      rawConnection,
      remoteAddress: rawConnection.remoteAddress,
      remotePort: rawConnection.remotePort,
    });
  }

  /**
   * Send a message to a client.
   *
   * @param connection Client connection object.
   * @param message Message to be sent.
   * @param messageCount Number of messages already sent for this connection.
   */
  public sendMessage(
    connection: ConnectionDetails,
    message: any,
    messageCount: number = 0,
  ) {
    if (message.error) {
      message.error = this.api.configs.errors.serializers.servers.tcp(
        message.error,
      );
    }

    // TODO: implement a message type
    if (connection.respondingTo) {
      message.messageCount = messageCount;
      connection.respondingTo = null;
    } else if (message.context === "response") {
      // if the messageCount isn't defined use the connection.messageCount
      if (messageCount) {
        message.messageCount = messageCount;
      } else {
        message.messageCount = connection.messageCount;
      }
    }

    try {
      connection.rawConnection.write(JSON.stringify(message) + "\r\n");
    } catch (e) {
      this.api.log(`socket write error: ${e}`, "error");
    }
  }

  /**
   * Send a file to client.
   *
   * @param connection Client connection object.
   * @param error Error object.
   * @param stream FileStream object.
   * @param mime
   * @param length
   * @param lastModified
   */
  public async sendFile(
    connection: ConnectionDetails,
    error: Error = null,
    stream: Stream,
    mime: string,
    length: number,
    lastModified: Date,
  ): Promise<void> {
    if (error) {
      this.sendMessage(connection, error, connection.messageCount);
    } else {
      stream.pipe(connection.rawConnection, { end: false });
    }
  }

  public async start(): Promise<void> {
    if (this.options.secure === false) {
      this.server = createServer(
        this.api.configs.servers.tcp.serverOptions,
        rawConnection => {
          this.handleConnection(rawConnection);
        },
      );
    } else {
      this.server = createSecureServer(
        this.api.configs.servers.tcp.serverOptions,
        rawConnection => {
          this.handleConnection(rawConnection);
        },
      );
    }

    this.server.on("error", error => {
      throw new Error(
        `Cannot start tcp server @ ${this.options.bindIP}:${
          this.options.port
        } => ${error.message}`,
      );
    });

    await new Promise(resolve =>
      this.server.listen(this.options.port, this.options.bindIP, resolve),
    );
  }

  public async stop(): Promise<void> {
    return this.innerStop();
  }

  /**
   * Close connection with client sending a bye message.
   *
   * @param connection Client connection.
   * @param reason Reason why connection will be closed.
   */
  public goodbye(connection: Connection, reason: string) {
    try {
      connection.rawConnection.end(
        JSON.stringify({
          status: connection.localize(
            this.api.configs.servers.tcp.goodbyeMessage,
          ),
          context: "api",
        }) + "\r\n",
      );
    } catch (error) {}
  }
}
