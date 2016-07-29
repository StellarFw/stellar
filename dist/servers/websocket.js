'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _util = require('util');

var _util2 = _interopRequireDefault(_util);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _primus = require('primus');

var _primus2 = _interopRequireDefault(_primus);

var _uglifyJs = require('uglify-js');

var _uglifyJs2 = _interopRequireDefault(_uglifyJs);

var _genericServer = require('../genericServer');

var _genericServer2 = _interopRequireDefault(_genericServer);

var _browser_fingerprint = require('browser_fingerprint');

var _browser_fingerprint2 = _interopRequireDefault(_browser_fingerprint);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

// server type
var type = 'websocket';

// server attributes
var attributes = {
  canChat: true,
  logConnections: true,
  logExists: true,
  sendWelcomeMessage: true,
  verbs: ['quit', 'exit', 'roomAdd', 'roomLeave', 'roomView', 'detailsView', 'say']
};

var WebSocketServer = function (_GenericServer) {
  _inherits(WebSocketServer, _GenericServer);

  /**
   * Creates a new server instance.
   *
   * @param api stellar engine interface.
   * @param options sever options.
   */

  function WebSocketServer(api, options) {
    _classCallCheck(this, WebSocketServer);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(WebSocketServer).call(this, api, type, options, attributes));

    var self = _this;

    // connection event
    self.on('connection', function (connection) {
      connection.rawConnection.on('data', function (data) {
        self._handleData(connection, data);
      });
    });

    // action complete event
    self.on('actionComplete', function (data) {
      if (data.toRender !== false) {
        data.connection.response.messageCount = data.messageCount;
        self.sendMessage(data.connection, data.response, data.messageCount);
      }
    });
    return _this;
  }

  // ------------------------------------------------------------------------------------------------ [REQUIRED METHODS]

  /**
   * Start the server
   *
   * @param callback
   */


  /**
   * Server instance.
   */


  _createClass(WebSocketServer, [{
    key: 'start',
    value: function start(callback) {
      var self = this;
      var webserver = self.api.servers.servers.web;

      // create a new primus instance
      self.server = new _primus2.default(webserver.server, self.api.config.servers.websocket.server);

      // define some event handlers
      self.server.on('connection', function (rawConnection) {
        return self._handleConnection(rawConnection);
      });
      self.server.on('disconnection', function (rawConnection) {
        return self._handleDisconnection(rawConnection);
      });

      self.api.log('webSocket bound to ' + webserver.options.bindIP + ':' + webserver.options.port, 'debug');
      self.server.active = true;

      // write client js
      self._writeClientJS();

      // execute the callback
      callback();
    }

    /**
     * Shutdown the websocket server.
     *
     * @param callback Callback
     */

  }, {
    key: 'stop',
    value: function stop(callback) {
      var self = this;

      // disable the server
      self.active = false;

      // destroy clients connections
      if (self.api.config.servers.websocket.destroyClientOnShutdown === true) {
        self.connections().forEach(function (connection) {
          connection.destroy();
        });
      }

      // execute the callback on the next tick
      process.nextTick(callback);
    }

    /**
     * Send a message.
     *
     * @param connection      Connection where the message must be sent.
     * @param message         Message to send.
     * @param messageCount    Message number.
     */

  }, {
    key: 'sendMessage',
    value: function sendMessage(connection, message, messageCount) {
      var self = this;

      // serialize the error if exists
      if (message.error) {
        message.error = self.api.config.errors.serializers.servers.websocket(message.error);
      }

      // if the message don't have a context set to 'response'
      if (!message.context) {
        message.context = 'response';
      }

      // if the messageCount isn't defined, get it from the connection object
      if (!messageCount) {
        messageCount = connection.messageCount;
      }

      if (message.context === 'response' && !message.messageCount) {
        message.messageCount = messageCount;
      }

      // write the message to socket
      connection.rawConnection.write(message);
    }

    /**
     * Action to be executed on a file request.
     *
     * @param connection      Client connection object.
     * @param error           Error, if exists.
     * @param fileStream      FileStream.
     * @param mime            Mime type.
     * @param length          File size.
     * @param lastModified    Last file modification timestamp.
     */

  }, {
    key: 'sendFile',
    value: function sendFile(connection, error, fileStream, mime, length, lastModified) {
      var self = this;

      var content = '';
      var response = {
        error: error,
        content: null,
        mime: mime,
        length: length,
        lastModified: lastModified
      };

      try {
        if (!error) {
          fileStream.on('data', function (d) {
            content += d;
          });
          fileStream.on('end', function () {
            response.content = content;
            self.server.sendMessage(connection, response, connection.messageCount);
          });
        } else {
          self.server.sendMessage(connection, response, connection.messageCount);
        }
      } catch (e) {
        self.api.log(e, 'warning');
        self.server.sendMessage(connection, response, connection.messageCount);
      }
    }

    /**
     * Action to be executed on the goodbye.
     *
     * @param connection Client connection to be closed.
     */

  }, {
    key: 'goodbye',
    value: function goodbye(connection) {
      connection.rawConnection.end();
    }

    //////////////////// [PRIVATE METHODS]

    /**
     * Compile client JS.
     *
     * @returns {*}
     * @private
     */

  }, {
    key: '_compileClientJS',
    value: function _compileClientJS() {
      var self = this;

      var clientSource = _fs2.default.readFileSync(__dirname + '/../client.js').toString();
      var url = self.api.config.servers.websocket.clientUrl;

      // replace any url by client url
      clientSource = clientSource.replace(/\'%%URL%%\'/g, url);

      var defaults = {};
      for (var i in self.api.config.servers.websocket.client) {
        defaults[i] = self.api.config.servers.websocket.client[i];
      }
      defaults.url = url;

      var defaultsString = _util2.default.inspect(defaults);
      defaultsString = defaultsString.replace('\'window.location.origin\'', 'window.location.origin');
      clientSource = clientSource.replace('\'%%DEFAULTS%%\'', defaultsString);

      return clientSource;
    }

    /**
     * Render client JS.
     *
     * @param minimize
     * @returns {*}
     * @private
     */

  }, {
    key: '_renderClientJs',
    value: function _renderClientJs() {
      var minimize = arguments.length <= 0 || arguments[0] === undefined ? false : arguments[0];

      var self = this;

      var libSource = self.api.servers.servers.websocket.server.library();
      var clientSource = self._compileClientJS();

      clientSource = ';;;\r\n' + '(function(exports){ \r\n' + clientSource + '\r\n' + 'exports.StellarClient = StellarClient; \r\n' + '})(typeof exports === \'undefined\' ? window : exports);';

      if (minimize) {
        return _uglifyJs2.default.minify(libSource + '\r\n\r\n\r\n' + clientSource, { fromString: true }).code;
      } else {
        return libSource + '\r\n\r\n\r\n' + clientSource;
      }
    }

    /**
     * Write client js code.
     */

  }, {
    key: '_writeClientJS',
    value: function _writeClientJS() {
      var self = this;

      if (self.api.config.servers.websocket.clientJsName) {
        var base = _path2.default.normalize(self.api.config.general.paths.temp + _path2.default.sep + self.api.config.servers.websocket.clientJsName);

        try {
          _fs2.default.writeFileSync(base + '.js', self._renderClientJs(false));
          self.api.log('write ' + base + '.js', 'debug');
          _fs2.default.writeFileSync(base + '.min.js', self._renderClientJs(true));
          self.api.log('wrote ' + base + '.min.js', 'debug');
        } catch (e) {
          self.api.log('Cannot write client-side JS for websocket server:', 'warning');
          self.api.log(e, 'warning');
          throw e;
        }
      }
    }

    /**
     * Handle connection.
     *
     * @param rawConnection   Raw connection object.
     * @private
     */

  }, {
    key: '_handleConnection',
    value: function _handleConnection(rawConnection) {
      var self = this;

      var parsedCookies = _browser_fingerprint2.default.parseCookies(rawConnection);
      var fingerPrint = parsedCookies[self.api.config.servers.web.fingerprintOptions.cookieKey];

      self.buildConnection({
        rawConnection: rawConnection,
        remoteAddress: rawConnection.address.ip,
        remotePort: rawConnection.address.port,
        fingerprint: fingerPrint
      });
    }

    /**
     * Handle the disconnection event.
     *
     * @param rawConnection
     * @private
     */

  }, {
    key: '_handleDisconnection',
    value: function _handleDisconnection(rawConnection) {
      var self = this;

      for (var i in self.connections()) {
        if (self.connections()[i] && rawConnection.id == self.connections()[i].rawConnection.id) {
          self.connections()[i].destroy();
          break;
        }
      }
    }
  }, {
    key: '_handleData',
    value: function _handleData(connection, data) {
      var self = this;

      var verb = data.event;
      delete data.event;

      connection.messageCount++;
      connection.params = {};

      (function () {
        switch (verb) {
          case 'action':
            for (var v in data.params) {
              connection.params[v] = data.params[v];
            }

            connection.error = null;
            connection.response = {};
            self.processAction(connection);
            break;

          case 'file':
            // setup the connection parameters
            connection.params = {
              file: data.file
            };

            // process the file request
            self.processFile(connection);
            break;

          default:
            var words = [];
            var message = void 0;

            if (data.room) {
              words.push(data.room);
              delete data.room;
            }

            for (var i in data) {
              words.push(data[i]);
            }

            connection.verbs(verb, words, function (error, data) {
              // if exists an error, send it to the client
              if (error) {
                message = { status: error, context: 'response', data: data };
                self.sendMessage(connection, message);
                return;
              }

              message = { status: 'OK', context: 'response', data: data };
              self.sendMessage(connection, message);
            });
            break;
        }
      })();
    }
  }]);

  return WebSocketServer;
}(_genericServer2.default);

exports.default = WebSocketServer;
//# sourceMappingURL=websocket.js.map
