import { EventEmitter } from "events";
import { ReadStream } from "fs";
import { Connection, LogLevel, ConnectionDetails } from "@stellarfw/common/lib/index.js";
import { API } from "@stellarfw/common/lib";

/**
 * This function is called when the method is not implemented.
 */
const methodNotDefined = () => {
  throw new Error("The containing method should be defined for this server type");
};

/**
 * Abstract class that is the basis of all servers.
 */
export abstract class GenericServer extends EventEmitter {
  /**
   * Human server's name.
   */
  protected static serverName: string;

  /**
   * Reference for the API object.
   */
  protected api: API;

  /**
   * Server type.
   */
  public type: string;

  /**
   * Server options.
   */
  public options: any = {};

  /**
   * Connection attributes.
   */
  public attributes: any = {};

  /**
   * Constructor.
   *
   * @param api Stellar's API reference
   * @param name Server's name
   * @param options Server's options
   */
  constructor(api, name, options) {
    super();

    this.api = api;
    this.type = name;
    this.options = options;

    // Attributes can be overwritten by the options
    for (const key of Object.keys(this.options)) {
      if (this.attributes[key] !== null && this.attributes[key] !== undefined) {
        this.attributes[key] = this.options[key];
      }
    }
  }

  /**
   * Get all active connection of this server.
   *
   * Note: This don't work in some type of servers.
   *
   * @returns {Array}
   */
  public connections(): Array<Connection> {
    const _connections: Array<Connection> = [];

    for (const key of Object.keys(this.api.connections.connections)) {
      const connection = this.api.connections.connections[key];
      if (connection.type === this.type) {
        _connections.push(connection);
      }
    }

    return _connections;
  }

  /**
   * Log function.
   *
   * @param message   Message to be logged.
   * @param severity  Severity level.
   * @param data      Additional data to be printed out.
   */
  protected log(message: string, severity: LogLevel, data: any = null) {
    this.api.log(`[Server: ${this.type}] ${message}`, severity, data);
  }

  /**
   * Process an action request.
   *
   * @param connection Connection object.
   */
  public processAction(connection) {
    const ActionProcessor = this.api.ActionProcessor;
    const actionProcessor = new ActionProcessor(this.api, connection, (data) => {
      this.emit("actionComplete", data);
    });

    actionProcessor.processAction();
  }

  public async sendFile(
    connection: ConnectionDetails,
    error: Error | null = null,
    stream: ReadStream,
    mime: string,
    length: number,
    lastModified: Date,
  ): Promise<void> {
    throw new Error("Not implemented!");
  }

  /**
   * Process a file request.
   *
   * @param connection Connection object.
   */
  public async processFile(connection): Promise<void> {
    const response = await this.api.staticFile.get(connection);
    return this.sendFile(
      connection,
      response.error,
      response.fileStream,
      response.mime,
      response.length,
      response.lastModified,
    );
  }

  /**
   * Build a new connection object.
   *
   * @param data Connection data
   */
  public buildConnection(data) {
    const details: ConnectionDetails = {
      type: this.type,
      id: data.id,
      remoteIP: data.remoteAddress,
      remotePort: data.remotePort,
      rawConnection: data.rawConnection,
      canChat: false,
      fingerprint: undefined,
      messageCount: 0,
      params: {},
    };

    // if the server canChat enable the flag on the connection
    if (this.attributes.canChat === true) {
      details.canChat = true;
    }

    // if the connection doesn't have a fingerprint already create one
    if (data.fingerprint) {
      details.fingerprint = data.fingerprint;
    }

    // create a new connection instance
    const connection = new Connection(this.api, details);

    // define sendMessage method
    connection.sendMessage = (message) => {
      this.sendMessage(connection, message);
    };

    // define sendFile method
    connection.sendFile = (path) => {
      connection.params.file = path;
      this.processFile(connection);
    };

    // emit the new connection object
    this.emit("connection", connection);

    // check if the lod for this type of connection is active
    if (this.attributes.logConnections === true) {
      this.log("new connection", LogLevel.Info, { to: connection.remoteIP });
    }

    // bidirectional connection can have a welcome message
    if (this.attributes.sendWelcomeMessage === true) {
      connection.sendMessage({
        welcome: this.api.configs.general.welcomeMessage,
        context: "api",
      });
    }

    if (typeof this.attributes.sendWelcomeMessage === "number") {
      setTimeout(() => {
        try {
          connection.sendMessage({
            welcome: this.api.configs.general.welcomeMessage,
            context: "api",
          });
        } catch (e) {
          this.api.log.error(e);
        }
      }, this.attributes.sendWelcomeMessage);
    }
  }

  /**
   * Invoked as part of boot.
   */
  public async start(): Promise<void> {
    methodNotDefined();
  }

  /**
   * Invoked as part of shutdown.
   */
  public async stop(): Promise<void> {
    methodNotDefined();
  }

  /**
   * This method will be appended to the connection as 'connection.sendMessage'
   *
   * @param connection  Connection object.
   * @param message     Message be sent back to the client.
   */
  public sendMessage(connection: ConnectionDetails, message: string, messageCount?: number) {
    methodNotDefined();
  }

  /**
   * This method will be used to gracefully disconnect the client.
   *
   * @param connection  Connection object.
   * @param reason      Reason for disconnection.
   */
  public goodbye(connection: ConnectionDetails, reason: string) {
    methodNotDefined();
  }
}
