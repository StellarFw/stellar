import UUID from 'node-uuid';

class Connections {

  middleware = {};

  globalMiddleware = {};

  allowedVerbs = [
    'quit',
    'exit',
    'say'
  ];

  /**
   * Hash with the active connections.
   *
   * @type {{}}
   */
  connections = {};
}

/**
 * Class who represents an active connection.
 */
class Connection {

  /**
   * Api reference.
   */
  api;

  /**
   * Unique client identifier.
   */
  id;

  /**
   * Timestamp of the connection.
   */
  connectedAt;

  /**
   * Create a new connection object.
   *
   * The data object needs to have the follow properties:
   *  - type
   *  - remotePort
   *  - remoteIP
   *  - rawConnection
   *
   * @param api Stellar API reference
   * @param data hash map
   */
  constructor(api, data) {
    let self = this;
    self.api = api;
    self._setup(data);

    // save this connection on the connection manager
    api.connections.connections[ self.id ] = self;

    // @todo middleware
  }

  /**
   * Initialize the connection object.
   *
   * @param data
   * @private
   */
  _setup(data) {
    let self = this;

    if (data.id) {
      self.id = data.id;
    } else {
      // generate an unique ID for this connection
      self.id = self._generateID();
    }

    // set the connection timestamp
    self.connectedAt = new Date().getTime();

    [ 'type', 'rawConnection' ].forEach(function (req) {
      if (data[ req ] === null || data[ req ] === undefined) {
        throw new Error(`{req} is required to create a new connection object`);
      }
      self[ req ] = data[ req ];
    });

    [ 'remotePort', 'remoteIP' ].forEach(function (req) {
      if (data[ req ] === null || data[ req ] === undefined) {
        if (api.config.general.enforceConnectionProperties === true) {
          throw new Error(`${req} is required to create a new connection object`);
        } else {
          data[ req ] = 0; // could be a random uuid as well?
        }
      }
      self[ req ] = data[ req ];
    });

    // set connection defaults
    let connectionDefaults = {
      error: null,
      params: {},
      fingerprint: null,
      pendingActions: 0,
      totalActions: 0,
      messageCount: 0
    };

    for (let i in connectionDefaults) {
      if (self[ i ] === undefined && data[ i ] !== undefined) {
        self[ i ] = data[ i ];
      }
      if (self[ i ] === undefined) {
        self[ i ] = connectionDefaults[ i ];
      }
    }
  }

  /**
   * Generate an unique identifier for this connection.
   *
   * @returns {*}
   * @private
   */
  _generateID() {
    return UUID.v4();
  }

  /**
   * Send a message to this connection.
   *
   * @param message
   */
  sendMessage(message) {
    throw new Error(`I should be replaced with a connection-specific method [${message}]`);
  }

  /**
   * Send a file to this connection.
   *
   * @param path
   */
  sendFile(path) {
    throw new Error(`I should be replaced with a connection-specific method [${path}]`);
  }

  destroy(callback) {
    let self = this;
    self.destroyed = true;

    // todo - remove connection from middleware

    delete self.api.connections.connections[ self.id ];
    let server = self.api.servers.servers[ self.type ];

    if (server) {
      if (server.attributes.logExits === true) {
        server.log('connection closed', 'info', {to: self.remoteIP});
      }

      if (typeof server.goodbye === 'function') {
        server.goodbye(self);
      }
    }

    if (typeof callback === 'function') {
      callback();
    }
  }

  /**
   * Set a new connection attribute.
   *
   * @param key
   * @param value
   */
  set(key, value) {
    let self = this;
    self[ key ] = value;
  }

  verbs(verb, words, callback) {
    console.log("TODO - Connection::verbs");
  }
}

export default class {

  /**
   * Initializer load priority.
   *
   * @type {number}
   */
  static loadPriority = 15;

  static load(api, next) {
    // put Connections instance available to all platform
    api.connections = new Connections();

    // put the connection class available to all platform
    api.connection = Connection;

    // finish the initializer loaded
    next();
  }

};
