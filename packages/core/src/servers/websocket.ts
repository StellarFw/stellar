import { normalize, sep } from "path";
import { ReadStream, writeFileSync, writeFile, readFileSync } from "fs";
import * as BrowserFingerprint from "browser_fingerprint";
import * as Primus from "primus";
import * as UglifyJS from "uglify-es";
import WebServer from "./web";
import { inspect } from "util";

import { GenericServer } from "@stellarfw/common/lib/generic-server";
import { LogLevel } from "@stellarfw/common/lib/enums/log-level.enum";
import ConnectionDetails from "@stellarfw/common/lib/interfaces/connection-details.interface";

export default class WebSocketServer extends GenericServer {
  protected static serverName: string = "websocket";

  /**
   * Primus server instance.
   */
  private server = null;

  private fingerprinter: any = null;

  constructor(api, options) {
    super(api, "websocket", options);
    this.attributes = {
      canChat: true,
      logConnections: true,
      logExists: true,
      sendWelcomeMessage: true,
      verbs: [
        "quit",
        "exit",
        "roomJoin",
        "roomLeave",
        "roomView",
        "detailsView",
        "say",
        "event",
      ],
    };

    this.on("connection", this.handleNewConnection.bind(this));
    this.on("actionComplete", this.handleActionComplete.bind(this));

    this.fingerprinter = new BrowserFingerprint(
      this.api.configs.servers.web.fingerprintOptions,
    );
  }

  private handleNewConnection(connection) {
    connection.rawConnection.on("data", data => {
      this.handleData(connection, data);
    });
  }

  private handleActionComplete(data: any): void {
    if (!data.toRender) {
      return;
    }

    data.connection.response.messageCount = data.messageCount;
    this.sendMessage(data.connection, data.response, data.messageCount);
  }

  /**
   * Handle data received by this server.
   *
   * @param connection Client connection.
   * @param data Received data.
   */
  private async handleData(
    connection: ConnectionDetails,
    data: any,
  ): Promise<void> {
    const verb = data.event;
    delete data.event;

    connection.messageCount += 1;
    connection.params = {};

    switch (verb) {
      case "action":
        connection.params = {
          ...connection.params,
          ...data.params,
        };

        connection.error = null;
        connection.response = {};
        this.processAction(connection);
        break;
      case "file":
        connection.params = {
          file: data.file,
        };

        this.processFile(connection);
        break;
      default:
        const words = [];
        let message;

        if (data.room) {
          words.push(data.room);
          delete data.room;
        }

        // TODO: maybe convert this to a more ES7 way of doing things
        for (const index in data) {
          if (data.hasOwnProperty(index)) {
            words.push(data[index]);
          }
        }

        try {
          const response = await connection.verbs(verb, words);
          message = { status: "OK", context: "response", data: response };
        } catch (error) {
          // TODO: check if we need the data object
          message = { status: error, context: "response" };
        }

        this.sendMessage(connection, message);
        break;
    }
  }

  /**
   * Handle connection.
   *
   * @param rawConnection Raw connection object.
   */
  private handleConnection(rawConnection): void {
    const parsedCookies = this.fingerprinter.parseCookies(rawConnection);
    const fingerprint =
      parsedCookies[this.api.configs.servers.web.fingerprintOptions.cookieKey];

    this.buildConnection({
      rawConnection,
      remoteAddress: rawConnection.address.ip,
      remotePort: rawConnection.address.port,
      fingerprint,
    });
  }

  /**
   * Handle the disconnection event.
   *
   * @param rawConnection Raw connection.
   */
  private handleDisconnection(rawConnection): void {
    const connections = this.connections();

    for (const i in connections) {
      if (
        connections[i] &&
        rawConnection.id === connections[i].rawConnection.id
      ) {
        connections[i].destroy();
        break;
      }
    }
  }

  /**
   * Start the server.
   */
  public async start(): Promise<void> {
    const webServer: WebServer = this.api.servers.servers.get("web");

    this.server = new Primus(
      webServer.server,
      this.api.configs.servers.websocket.server,
    );

    // Define the necessary event handlers
    this.server.on("connection", this.handleConnection.bind(this));
    this.server.on("disconnection", this.handleDisconnection.bind(this));

    this.api.log(
      `WebSocket bound to ${webServer.options.bindIP}:${webServer.options.port}`,
      LogLevel.Debug,
    );

    this.server.active = true;

    this.writeClientJS();
  }

  /**
   * Shutdown the websocket server.
   */
  public async stop(): Promise<void> {
    this.server.active = false;

    if (this.api.configs.servers.websocket.destroyClientOnShutdown === true) {
      this.connections().forEach((connection: ConnectionDetails) => {
        connection.destroy();
      });
    }
  }

  /**
   * Send a message.
   *
   * @param connection Connection where the message must be sent.
   * @param message Message to be sent.
   * @param messageCount Message number.
   */
  public sendMessage(
    connection: ConnectionDetails,
    message: any,
    messageCount: number = null,
  ) {
    if (message.error) {
      message.error = this.api.configs.errors.serializers.servers.websocket(
        message.error,
      );
    }

    if (!message.context) {
      message.context = "response";
    }

    if (!messageCount) {
      messageCount = connection.messageCount;
    }

    if (message.context === "response" && !message.messageCount) {
      message.messageCount = messageCount;
    }

    connection.rawConnection.write(message);
  }

  /**
   * Action to be execution on the goodbye.
   *
   * @param connection Client connection to be closed.
   */
  public goodbye(connection: ConnectionDetails) {
    connection.rawConnection.end();
  }

  /**
   * Action to be execution on a file request.
   *
   * @param connection Client connection object.
   * @param error Error, if exists.
   * @param stream FileStream
   * @param mime Mime type.
   * @param length File size.
   * @param lastModified Last file modification timestamp.
   */
  public async sendFile(
    connection: ConnectionDetails,
    error: Error = null,
    fileStream: ReadStream,
    mime: string,
    length: number,
    lastModified: Date,
  ): Promise<void> {
    let content = "";
    const response = {
      error,
      content: null,
      mime,
      length,
      lastModified,
    };

    try {
      if (!error) {
        fileStream.on("data", d => {
          content += d;
        });

        fileStream.on("end", () => {
          response.content = content;
          this.server.sendMessage(
            connection,
            response,
            connection.messageCount,
          );
        });
      }

      this.server.sendMessage(connection, response, connection.messageCount);
    } catch (e) {
      this.api.log(e, "warning");
      this.server.sendMessage(connection, response, connection.messageCount);
    }
  }

  /**
   * Compile client JS.
   */
  private compileClientJs(): string {
    let clientSource: string = readFileSync(
      `${__dirname}/../client.js`,
    ).toString();
    const url: string = this.api.configs.servers.websocket.clientUrl;

    clientSource = clientSource.replace(/\'%%URL%%\'/g, url);

    const defaults = {
      ...this.api.configs.servers.websocket.client,
      url,
      // Append the number of simultaneous connections allowed
      simultaneousActions: this.api.configs.general.simultaneousActions,
    };

    let defaultsString: string = inspect(defaults);
    defaultsString = defaultsString.replace(
      `'window.location.origin'`,
      "window.location.origin",
    );
    clientSource = clientSource.replace(`'%%DEFAULTS%%'`, defaultsString);

    return clientSource;
  }

  /**
   * Render client JS.
   *
   * @param minimize Should we enable minification?
   */
  private renderClientJs(minimize: boolean = false): string {
    const libSource = this.server.library();
    let clientSource = this.compileClientJs();

    clientSource = `
      ;;;\r\n
      (function (exports){ \r\n
        ${clientSource} \r\n
        exports.Stellar = Stellar;\r\n
      })(typeof exports === 'undefined' ? window : exports);
    `;

    if (minimize) {
      return UglifyJS.minify(`${libSource}\r\n\r\n\r\n${clientSource}`).code;
    }

    return `${libSource}\r\n\r\n\r\n${clientSource}`;
  }

  /**
   * Write client JS code.
   */
  private writeClientJS(): void {
    // Ensure the public folder exists
    if (!this.api.utils.dirExists(`${this.api.configs.general.paths.public}`)) {
      this.api.utils.createDir(`${this.api.configs.general.paths.public}`);
    }

    if (this.api.configs.servers.websocket.clientJsName) {
      const base = normalize(
        this.api.configs.general.paths.public +
          sep +
          this.api.configs.servers.websocket.clientJsName,
      );

      try {
        writeFileSync(`${base}.js`, this.renderClientJs(false));
        this.api.log(`write ${base}.js`, LogLevel.Debug);
        writeFileSync(`${base}.min.js`, this.renderClientJs(true));
        this.api.log(`wrote ${base}.min.js`, LogLevel.Debug);
      } catch (e) {
        this.api.log(
          "Cannot write client-side JS for WebSocket server: ",
          LogLevel.Warning,
        );
        this.api.log(e, LogLevel.Warning);
        throw e;
      }
    }
  }
}
