'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _events = require('events');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * This function is called when the method is not implemented.
 */
var methodNotDefined = function methodNotDefined() {
  throw new Error('The containing method should be defined for this server type');
};

/**
 * This is the prototypical generic server class that all other types
 * of servers inherit from.
 */

var GenericServer = function (_EventEmitter) {
  _inherits(GenericServer, _EventEmitter);

  /**
   * Constructor.
   *
   * @param api
   * @param name
   * @param options
   * @param attributes
   */


  /**
   * API object reference.
   */


  /**
   * Connection type.
   */


  /**
   * Connection options.
   */
  function GenericServer(api, name, options, attributes) {
    _classCallCheck(this, GenericServer);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(GenericServer).call(this));
    // call super class constructor


    _this.api = api;
    _this.type = name;
    _this.options = options;
    _this.attributes = attributes;

    // attributes can be overwritten by the options
    for (var key in _this.options) {
      if (_this.attributes[key] !== null && _this.attributes[key] !== undefined) {
        _this.attributes[key] = _this.options[key];
      }
    }
    return _this;
  }

  /**
   * Build a new connection object.
   *
   * @param data Connection data.
   */


  /**
   * Connection attributes.
   */


  _createClass(GenericServer, [{
    key: 'buildConnection',
    value: function buildConnection(data) {
      var self = this;

      var details = {
        type: self.type,
        id: data.id,
        remotePort: data.remotePort,
        remoteIP: data.remoteAddress,
        rawConnection: data.rawConnection
      };

      // if the server canChat enable the flag on the connection
      if (self.attributes.canChat === true) {
        details.canChat = true;
      }

      // if the connection doesn't have a fingerprint already create one
      if (data.fingerprint) {
        details.fingerprint = data.fingerprint;
      }

      // get connection class
      var ConnectionClass = self.api.connection;

      // create a new connection instance
      var connection = new ConnectionClass(self.api, details);

      // define sendMessage method
      connection.sendMessage = function (message) {
        self.sendMessage(connection, message);
      };

      // define sendFile method
      connection.sendFile = function (path) {
        connection.params.file = path;
        self.processFile(connection);
      };

      // emit the new connection object
      self.emit('connection', connection);

      // check if the lod for this type of connection is active
      if (self.attributes.logConnections === true) {
        self.log('new connection', 'info', { to: connection.remoteIP });
      }

      // bidirectional connection can have a welcome message
      if (self.attributes.sendWelcomeMessage === true) {
        connection.sendMessage({ welcome: self.api.config.general.welcomeMessage, context: 'api' });
      }

      if (typeof self.attributes.sendWelcomeMessage === 'number') {
        setTimeout(function () {
          try {
            connection.sendMessage({ welcome: self.api.config.general.welcomeMessage, context: 'api' });
          } catch (e) {
            self.api.log.error(e);
          }
        }, self.attributes.sendWelcomeMessage);
      }
    }

    /**
     * Process an action request.
     *
     * @param connection Connection object.
     */

  }, {
    key: 'processAction',
    value: function processAction(connection) {
      var self = this;

      // create a new action processor instance for this request
      var actionProcessor = new this.api.actionProcessor(self.api, connection, function (data) {
        self.emit('actionComplete', data);
      });

      // process the request
      actionProcessor.processAction();
    }

    /**
     * Process a file request.
     *
     * @param connection Connection object.
     */

  }, {
    key: 'processFile',
    value: function processFile(connection) {
      var self = this;

      self.api.staticFile.get(connection, function (connection, error, fileStream, mime, length, lastModified) {
        self.sendFile(connection, error, fileStream, mime, length, lastModified);
      });
    }

    /**
     * Get all active connection of this server.
     *
     * This don't work in some type of servers.
     *
     * @returns {Array}
     */

  }, {
    key: 'connections',
    value: function connections() {
      var _connections = [];

      for (var i in this.api.connections.connections) {
        var connection = this.api.connections.connections[i];
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

  }, {
    key: 'log',
    value: function log(message, severity, data) {
      var self = this;
      self.api.log('[Server: ' + this.type + '] ' + message, severity, data);
    }

    /**
     * Invoked as part of boot.
     */

  }, {
    key: 'start',
    value: function start(next) {
      methodNotDefined();
    }

    /**
     * Invoked as part of shutdown.
     */

  }, {
    key: 'stop',
    value: function stop(next) {
      methodNotDefined();
    }

    /**
     * This method will be appended to the connection as 'connection.sendMessage'
     *
     * @param connection  Connection object.
     * @param message     Message be sent back to the client.
     */

  }, {
    key: 'sendMessage',
    value: function sendMessage(connection, message) {
      methodNotDefined();
    }

    /**
     * This method will be used to gracefully disconnect the client.
     *
     * @param connection  Connection object.
     * @param reason      Reason for disconnection.
     */

  }, {
    key: 'goodbye',
    value: function goodbye(connection, reason) {
      methodNotDefined();
    }
  }]);

  return GenericServer;
}(_events.EventEmitter);

exports.default = GenericServer;