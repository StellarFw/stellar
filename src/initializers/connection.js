import UUID from 'node-uuid';

class Connections {

  middleware = {};

  globalMiddleware = {};

  allowedVerbs = [
    'quit',
    'exit',
    'paramAdd',
    'paramDelete',
    'paramView',
    'paramsView',
    'paramsDelete',
    'roomAdd',
    'roomLeave',
    'roomView',
    'detailsView',
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
        if (self.api.config.general.enforceConnectionProperties === true) {
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
      rooms: [],
      fingerprint: null,
      pendingActions: 0,
      totalActions: 0,
      messageCount: 0,
      canChat: false
    };

    for (let i in connectionDefaults) {
      if (self[ i ] === undefined && data[ i ] !== undefined) { self[ i ] = data[ i ]; }
      if (self[ i ] === undefined) { self[ i ] = connectionDefaults[ i ]; }
    }

    self.api.i18n.invokeConnectionLocale(self);
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

  /**
   * Localize a message.
   *
   * @param message   Message to be localized.
   */
  localize(message) {
    let self = this;

    // this.locale will be sourced automatically
    if (!Array.isArray(message)) {
      message = [ message ];
    }
    return self.api.i18n.i18n.__.apply(this, message);
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

  /**
   *
   * @param verb
   * @param words Words are optional.
   * @param callback
   */
  verbs(verb, words, callback) {
    let self = this;
    let key, value, room;
    let server = self.api.servers.servers[ self.type ];
    let allowedVerbs = server.attributes.verbs;

    if (typeof words === 'function' && !callback) {
      callback = words;
      words = [];
    }

    if (!(words instanceof Array)) {
      words = [ words ];
    }

    if (server && allowedVerbs.indexOf(verb) >= 0) {
      server.log('verb', 'debug', {verb: verb, to: self.remoteIP, params: JSON.stringify(words)});

      if (verb === 'quit' || verb === 'exit') {
        server.goodbye(self);
      } else if (verb === 'paramAdd') {
        key = words[ 0 ];
        value = words[ 1 ];

        if (words[ 0 ] && (words[ 0 ].indexOf('=') >= 0)) {
          let parts = words[ 0 ].split('=');
          key = parts[ 0 ];
          value = parts[ 1 ];
        }

        self.params[ key ] = value;

        if (typeof callback === 'function') {
          callback(null, null);
        }
      } else if (verb === 'paramDelete') {
        key = words[ 0 ];
        delete self.params[ key ];

        if (typeof callback === 'function') {
          callback(null, null);
        }
      } else if (verb === 'roomAdd') {
        room = words[ 0 ];
        self.api.chatRoom.addMember(self.id, room, function (err, didHappen) {
          if (typeof callback === 'function') {
            callback(err, didHappen);
          }
        });
      } else if (verb === 'roomLeave') {
        room = words[ 0 ];
        self.api.chatRoom.removeMember(self.id, room, function (err, didHappen) {
          if (typeof callback === 'function') { callback(err, didHappen); }
        });
      } else if (verb === 'roomView') {
        // get requested room name
        room = words[ 0 ];

        if (self.rooms.indexOf(room) > -1) {
          self.api.chatRoom.roomStatus(room, (err, roomStatus) => {
            if (typeof callback === 'function') { callback(err, roomStatus); }
          });
        } else {
          if (typeof callback === 'function') { callback(`not member of room ${room}`); }
        }
      } else if (verb === 'detailsView') {
        let details = {};
        details.id = self.id;
        details.fingerprint = self.fingerprint;
        details.remoteIP = self.remoteIP;
        details.remotePort = self.remotePort;
        details.params = self.params;
        details.connectedAt = self.connectedAt;
        details.rooms = self.rooms;
        details.totalActions = self.totalActions;
        details.pendingActions = self.pendingActions;
        if (typeof callback === 'function') {
          callback(null, details);
        }
      } else if (verb === 'say') {
        room = words.shift();
        self.api.chatRoom.broadcast(self, room, words.join(' '), function (err) {
          if (typeof callback === 'function') {
            callback(err);
          }
        });
      } else {
        if (typeof callback === 'function') {
          callback(self.api.config.errors.verbNotFound(self, verb), null);
        }
      }
    } else {
      if (typeof callback === 'function') {
        callback(self.api.config.errors.verbNotAllowed(self, verb), null);
      }
    }
  }
}

export default class {

  /**
   * Initializer load priority.
   *
   * @type {number}
   */
  static loadPriority = 400;

  static load(api, next) {
    // put Connections instance available to all platform
    api.connections = new Connections();

    // put the connection class available to all platform
    api.connection = Connection;

    // finish the initializer loaded
    next();
  }

};
