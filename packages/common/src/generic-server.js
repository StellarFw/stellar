"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const log_level_enum_1 = require("./enums/log-level.enum");
const connection_1 = require("./connection");
const methodNotDefined = () => {
  throw new Error("The containing method should be defined for this server type");
};
class GenericServer extends events_1.EventEmitter {
  constructor(api, name, options) {
    super();
    this.api = null;
    this.type = null;
    this.options = {};
    this.attributes = {};
    this.api = api;
    this.type = name;
    this.options = options;
    for (const key of Object.keys(this.options)) {
      if (this.attributes[key] !== null && this.attributes[key] !== undefined) {
        this.attributes[key] = this.options[key];
      }
    }
  }
  connections() {
    const _connections = [];
    for (const key of Object.keys(this.api.connections.connections)) {
      const connection = this.api.connections.connections[key];
      if (connection.type === this.type) {
        _connections.push(connection);
      }
    }
    return _connections;
  }
  log(message, severity, data = null) {
    this.api.log(`[Server: ${this.type}] ${message}`, severity, data);
  }
  processAction(connection) {
    const ActionProcessor = this.api.ActionProcessor;
    const actionProcessor = new ActionProcessor(this.api, connection, data => {
      this.emit("actionComplete", data);
    });
    actionProcessor.processAction();
  }
  async sendFile(connection, error = null, stream, mime, length, lastModified) {
    throw new Error("Not implemented!");
  }
  async processFile(connection) {
    const response = await this.api.staticFile.get(connection);
    return this.sendFile(connection, response.error, response.fileStream, response.mime, response.length, response.lastModified);
  }
  buildConnection(data) {
    const details = {
      type: this.type,
      id: data.id,
      remoteIP: data.remoteAddress,
      remotePort: data.remotePort,
      rawConnection: data.rawConnection,
      canChat: false,
      fingerprint: null,
      messageCount: 0,
    };
    if (this.attributes.canChat === true) {
      details.canChat = true;
    }
    if (data.fingerprint) {
      details.fingerprint = data.fingerprint;
    }
    const connection = new connection_1.Connection(this.api, details);
    connection.sendMessage = message => {
      this.sendMessage(connection, message);
    };
    connection.sendFile = path => {
      connection.params.file = path;
      this.processFile(connection);
    };
    this.emit("connection", connection);
    if (this.attributes.logConnections === true) {
      this.log("new connection", log_level_enum_1.LogLevel.Info, { to: connection.remoteIP });
    }
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
        }
        catch (e) {
          this.api.log.error(e);
        }
      }, this.attributes.sendWelcomeMessage);
    }
  }
  async start() {
    methodNotDefined();
  }
  async stop() {
    methodNotDefined();
  }
  sendMessage(connection, message, messageCount = null) {
    methodNotDefined();
  }
  goodbye(connection, reason) {
    methodNotDefined();
  }
}
GenericServer.serverName = null;
exports.GenericServer = GenericServer;
//# sourceMappingURL=generic-server.js.map