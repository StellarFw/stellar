import {EventEmitter} from 'events';

/**
 * This function is called when the method is not implemented.
 */
let methodNotDefined = function () {
  throw new Error('The containing method should be defined for this server type');
};

/**
 * This is the prototypical generic server class that all other types
 * of servers inherit from.
 */
export default class GenericServer extends EventEmitter {

  api;
  type;
  options;
  attributes;

  constructor(api, name, options, attributes) {
    super();

    this.api = api;
    this.type = name;
    this.options = options;
    this.attributes = attributes;

    // attributes can be overwritten by the options
    for (let key in this.options) {
      if (this.attributes[key] !== null && this.attributes[key] !== undefined) {
        this.attributes[key] = this.options[key];
      }
    }
  }

  buildConnection(data) {
    let self = this;

    let details = {
      type: self.type,
      id: data.id,
      remotePort: data.remotePort,
      remoteIP: data.remoteAddress,
      rawConnection: data.rawConnection
    };

    if (data.fingerprint) {
      details.fingerprint = data.fingerprint;
    }

    let connection = new self.api.connection(self.api, details);

    connection.sendMessage = function (message) {
      self.sendMessage(connection, message);
    };

    connection.sendFile = function (path) {
      connection.params.file = path;
      self.processFile(connection);
    };

    this.emit('connection', connection);

    if (this.attributes.logConnections === true) {
      this.log('new connection', 'info', {to: connection.remoteIP});
    }

    if (this.attributes.sendWelcomeMessage === true) {
      connection.sendMessage({welcome: this.api.config.general.welcomeMessage, context: 'api'});
    }

    if (typeof this.attributes.sendWelcomeMessage === 'number') {
      setTimeout(function () {
        try {
          connection.sendMessage({welcome: self.api.config.general.welcomeMessage, context: 'api'});
        } catch (e) {
          self.api.log.error(e);
        }
      }, self.attributes.sendWelcomentMessage);
    }
  }

  processAction(connection) {
    let self = this;
    let actionProcessor = new this.api.actionProcessor(self.api, connection, function (data) {
      self.emit('actionComplete', data);
    });

    actionProcessor.processAction();
  }

  processFile(connection) {
    let self = this;
    this.api.staticFile.get(connection, function (connection, error, fileStream, mime, length, lastModified) {
      self.sendFile(connection, error, fileStream, mime, length, lastModified);
    });
  }

  connections() {
    let _connections = [];

    for (let i in this.api.connections.connections) {
      let connection = this.api.connections.connections[i];
      if (connection.type === this.type) {
        _connections.push(connection);
      }
    }

    return _connections;
  }

  log(message, severity, data) {
    switch (severity) {
      case 'inform':
        this.api.log.inform(`[Server: ${this.type}] ${message}`, data);
        break;
    }
  }

  /**
   * Invoked as part of boot.
   */
  start(next) {
    methodNotDefined();
  }

  /**
   * Invoked as aprt of shutdown.
   */
  stop(next) {
    methodNotDefined();
  }

  /**
   * This method will be appended to the connection as 'connection.sendMessage'
   *
   * @param connection
   * @param message
   */
  sendMessage(connection, message) {
    methodNotDefined();
  }

  /**
   * This method will be used to gracefully disconnect the client.
   *
   * @param connection
   * @param reason
   */
  goodbye(connection, reason) {
    methodNotDefined();
  }

}
