'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _nodeUuid = require('node-uuid');

var _nodeUuid2 = _interopRequireDefault(_nodeUuid);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Create a clean connection.
 *
 * @param connection  Connection object.
 * @returns {{}}      New clean connection object.
 */
var cleanConnection = function cleanConnection(connection) {
  var clean = {};

  for (var i in connection) {
    if (i !== 'rawConnection') {
      clean[i] = connection[i];
    }
  }

  return clean;
};

var Connections = function () {

  /**
   * Create a new class instance.
   *
   * @param api   API object reference.
   */


  /**
   * Array with the allowed verbs.
   *
   * @type {string[]}
   */


  /**
   * Hash with all registered middleware.
   *
   * @type {{}}
   */

  function Connections(api) {
    _classCallCheck(this, Connections);

    this.middleware = {};
    this.globalMiddleware = [];
    this.allowedVerbs = ['quit', 'exit', 'paramAdd', 'paramDelete', 'paramView', 'paramsView', 'paramsDelete', 'roomAdd', 'roomLeave', 'roomView', 'detailsView', 'say'];
    this.connections = {};
    this.api = api;
  }

  /**
   * Add a new middleware.
   *
   * @param data  Middleware to be added.
   */


  /**
   * Hash with the active connections.
   *
   * @type {{}}
   */


  /**
   * Array with global middleware.
   *
   * @type {Array}
   */


  /**
   * API reference object.
   */


  _createClass(Connections, [{
    key: 'addMiddleware',
    value: function addMiddleware(data) {
      var self = this;

      // middleware require a name
      if (!data.name) {
        throw new Error('middleware.name is required');
      }

      // if there is no defined priority use the default
      if (!data.priority) {
        data.priority = self.api.config.general.defaultMiddlewarePriority;
      }

      // ensure the priority is a number
      data.priority = Number(data.priority);

      // save the new middleware
      self.middleware[data.name] = data;

      // push the new middleware to the global list
      self.globalMiddleware.push(data.name);

      // sort the global middleware array
      self.globalMiddleware.sort(function (a, b) {
        if (self.middleware[a].priority > self.middleware[b].priority) {
          return 1;
        }

        return -1;
      });
    }
  }, {
    key: 'apply',
    value: function apply(connectionId, method, args, callback) {
      var self = this;

      if (args === undefined && callback === undefined && typeof method === 'function') {
        callback = method;
        args = null;
        method = null;
      }

      self.api.redis.doCluster('api.connections.applyCatch', [connectionId, method, args], connectionId, callback);
    }
  }, {
    key: 'applyCatch',
    value: function applyCatch(connectionId, method, args, callback) {
      var self = this;

      var connection = self.api.connections.connections[connectionId];
      if (method && args) {
        if (method === 'sendMessage' || method === 'sendFile') {
          connection[method](args);
        } else {
          connection[method].apply(connection, args);
        }
      }

      if (typeof callback === 'function') {
        process.nextTick(function () {
          callback(cleanConnection(connection));
        });
      }
    }
  }]);

  return Connections;
}();

/**
 * Class who represents an active connection.
 */


var Connection = function () {

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


  /**
   * Api reference.
   */


  /**
   * Unique client identifier.
   */


  /**
   * Timestamp of the connection.
   */

  function Connection(api, data) {
    _classCallCheck(this, Connection);

    this.rooms = [];

    var self = this;

    self.api = api;
    self._setup(data);

    // save this connection on the connection manager
    api.connections.connections[self.id] = self;

    // execute the middleware
    self.api.connections.globalMiddleware.forEach(function (middlewareName) {
      if (typeof self.api.connections.middleware[middlewareName].create === 'function') {
        self.api.connections.middleware[middlewareName].create(self);
      }
    });
  }

  /**
   * Initialize the connection object.
   *
   * @param data
   * @private
   */


  /**
   * Rooms which the client belongs.
   *
   * @type {Array}
   */


  _createClass(Connection, [{
    key: '_setup',
    value: function _setup(data) {
      var self = this;

      if (data.id) {
        self.id = data.id;
      } else {
        // generate an unique ID for this connection
        self.id = self._generateID();
      }

      // set the connection timestamp
      self.connectedAt = new Date().getTime();

      ['type', 'rawConnection'].forEach(function (req) {
        if (data[req] === null || data[req] === undefined) {
          throw new Error(req + ' is required to create a new connection object');
        }
        self[req] = data[req];
      });

      ['remotePort', 'remoteIP'].forEach(function (req) {
        if (data[req] === null || data[req] === undefined) {
          if (self.api.config.general.enforceConnectionProperties === true) {
            throw new Error(req + ' is required to create a new connection object');
          } else {
            data[req] = 0; // could be a random uuid as well?
          }
        }
        self[req] = data[req];
      });

      // set connection defaults
      var connectionDefaults = {
        error: null,
        params: {},
        rooms: [],
        fingerprint: null,
        pendingActions: 0,
        totalActions: 0,
        messageCount: 0,
        canChat: false
      };

      for (var i in connectionDefaults) {
        if (self[i] === undefined && data[i] !== undefined) {
          self[i] = data[i];
        }
        if (self[i] === undefined) {
          self[i] = connectionDefaults[i];
        }
      }

      self.api.i18n.invokeConnectionLocale(self);
    }

    /**
     * Generate an unique identifier for this connection.
     *
     * @returns {*}
     * @private
     */

  }, {
    key: '_generateID',
    value: function _generateID() {
      return _nodeUuid2.default.v4();
    }

    /**
     * Send a message to this connection.
     *
     * @param message
     */

  }, {
    key: 'sendMessage',
    value: function sendMessage(message) {
      throw new Error('I should be replaced with a connection-specific method [' + message + ']');
    }

    /**
     * Send a file to this connection.
     *
     * @param path
     */

  }, {
    key: 'sendFile',
    value: function sendFile(path) {
      throw new Error('I should be replaced with a connection-specific method [' + path + ']');
    }

    /**
     * Localize a message.
     *
     * @param message   Message to be localized.
     */

  }, {
    key: 'localize',
    value: function localize(message) {
      var self = this;
      return self.api.i18n.localize(message, self);
    }
  }, {
    key: 'destroy',
    value: function destroy(callback) {
      var self = this;

      // set connection as destroyed
      self.destroyed = true;

      // execute the destroy middleware
      self.api.connections.globalMiddleware.forEach(function (middlewareName) {
        if (typeof self.api.connections.middleware[middlewareName].destroy === 'function') {
          self.api.connections.middleware[middlewareName].destroy(self);
        }
      });

      // remove the connection from all rooms
      if (self.canChat === true) {
        self.rooms.forEach(function (room) {
          return self.api.chatRoom.removeMember(self.id, room);
        });
      }

      // get server instance
      var server = self.api.servers.servers[self.type];

      if (server) {
        if (server.attributes.logExits === true) {
          server.log('connection closed', 'info', { to: self.remoteIP });
        }

        if (typeof server.goodbye === 'function') {
          server.goodbye(self);
        }
      }

      // remove this connection from the connections array
      delete self.api.connections.connections[self.id];

      // execute the callback function
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

  }, {
    key: 'set',
    value: function set(key, value) {
      var self = this;
      self[key] = value;
    }

    /**
     * Execute the right operation for the given verb.
     *
     * @param verb      Verb to be executed.
     * @param words     Words are optional.
     * @param callback  Callback function.
     */

  }, {
    key: 'verbs',
    value: function verbs(verb, words, callback) {
      var self = this;

      var key = void 0,
          value = void 0,
          room = void 0;
      var server = self.api.servers.servers[self.type];
      var allowedVerbs = server.attributes.verbs;

      if (typeof words === 'function' && !callback) {
        callback = words;
        words = [];
      }

      if (!(words instanceof Array)) {
        words = [words];
      }

      if (server && allowedVerbs.indexOf(verb) >= 0) {
        // log verb message
        server.log('verb', 'debug', { verb: verb, to: self.remoteIP, params: JSON.stringify(words) });

        if (verb === 'quit' || verb === 'exit') {
          server.goodbye(self);
        } else if (verb === 'paramAdd') {
          key = words[0];
          value = words[1];

          if (words[0] && words[0].indexOf('=') >= 0) {
            var parts = words[0].split('=');
            key = parts[0];
            value = parts[1];
          }

          self.params[key] = value;

          // execute the callback function
          if (typeof callback === 'function') {
            callback(null, null);
          }
        } else if (verb === 'paramDelete') {
          key = words[0];
          delete self.params[key];

          // execute the callback function
          if (typeof callback === 'function') {
            callback(null, null);
          }
        } else if (verb === 'paramView') {
          key = words[0];

          if (typeof callback === 'function') {
            callback(null, self.params[key]);
          }
        } else if (verb === 'paramsView') {
          if (typeof callback === 'function') {
            callback(null, self.params);
          }
        } else if (verb === 'paramsDelete') {
          // delete all params
          for (var i in self.params) {
            delete self.params[i];
          }

          if (typeof callback === 'function') {
            callback(null, null);
          }
        } else if (verb === 'roomAdd') {
          room = words[0];

          self.api.chatRoom.addMember(self.id, room, function (error, didHappen) {
            if (typeof callback === 'function') {
              callback(error, didHappen);
            }
          });
        } else if (verb === 'roomLeave') {
          room = words[0];
          self.api.chatRoom.removeMember(self.id, room, function (error, didHappen) {
            if (typeof callback === 'function') {
              callback(error, didHappen);
            }
          });
        } else if (verb === 'roomView') {
          // get requested room name
          room = words[0];

          if (self.rooms.indexOf(room) > -1) {
            self.api.chatRoom.roomStatus(room, function (error, roomStatus) {
              if (typeof callback === 'function') {
                callback(error, roomStatus);
              }
            });
          } else {
            if (typeof callback === 'function') {
              callback('not member of room ' + room);
            }
          }
        } else if (verb === 'detailsView') {
          var details = {
            id: self.id,
            fingerprint: self.fingerprint,
            remoteIP: self.remoteIP,
            remotePort: self.remotePort,
            params: self.params,
            connectedAt: self.connectedAt,
            rooms: self.rooms,
            totalActions: self.totalActions,
            pendingActions: self.pendingActions
          };

          // execute the callback function
          if (typeof callback === 'function') {
            callback(null, details);
          }
        } else if (verb === 'say') {
          // get the room name
          room = words.shift();

          // broadcast the message on the requested room
          self.api.chatRoom.broadcast(self, room, words.join(' '), function (error) {
            if (typeof callback === 'function') {
              callback(error);
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
  }]);

  return Connection;
}();

var _class = function () {
  function _class() {
    _classCallCheck(this, _class);

    this.loadPriority = 400;
  }

  /**
   * Satellite load priority.
   *
   * @type {number}
   */


  _createClass(_class, [{
    key: 'load',


    /**
     * Satellite load function.
     *
     * @param api   API reference object.
     * @param next  Callback function.
     */
    value: function load(api, next) {
      // put Connections instance available to all platform
      api.connections = new Connections(api);

      // put the connection Class available to all platform
      api.connection = Connection;

      // finish the loading process
      next();
    }
  }]);

  return _class;
}();

exports.default = _class;
//# sourceMappingURL=connection.js.map
