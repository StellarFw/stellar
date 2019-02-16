'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _util = require('util');

var _util2 = _interopRequireDefault(_util);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _primus = require('primus');

var _primus2 = _interopRequireDefault(_primus);

var _uglifyEs = require('uglify-es');

var _uglifyEs2 = _interopRequireDefault(_uglifyEs);

var _genericServer = require('../genericServer');

var _genericServer2 = _interopRequireDefault(_genericServer);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// server type
let type = 'websocket';

// server attributes
let attributes = {
  canChat: true,
  logConnections: true,
  logExists: true,
  sendWelcomeMessage: true,
  verbs: ['quit', 'exit', 'roomJoin', 'roomLeave', 'roomView', 'detailsView', 'say', 'event']
};

class WebSocketServer extends _genericServer2.default {

  /**
   * Creates a new server instance.
   *
   * @param api stellar engine interface.
   * @param options sever options.
   */
  constructor(api, options) {
    super(api, type, options, attributes);

    let self = this;

    // connection event
    self.on('connection', connection => {
      connection.rawConnection.on('data', data => {
        self._handleData(connection, data);
      });
    });

    // action complete event
    self.on('actionComplete', data => {
      if (data.toRender !== false) {
        data.connection.response.messageCount = data.messageCount;
        self.sendMessage(data.connection, data.response, data.messageCount);
      }
    });
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
  start(callback) {
    let self = this;
    let webserver = self.api.servers.servers.web;

    // create a new primus instance
    self.server = new _primus2.default(webserver.server, self.api.config.servers.websocket.server);

    // define some event handlers
    self.server.on('connection', rawConnection => self._handleConnection(rawConnection));
    self.server.on('disconnection', rawConnection => self._handleDisconnection(rawConnection));

    self.api.log(`webSocket bound to ${webserver.options.bindIP}:${webserver.options.port}`, 'debug');
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
  stop(callback) {
    let self = this;

    // disable the server
    self.active = false;

    // destroy clients connections
    if (self.api.config.servers.websocket.destroyClientOnShutdown === true) {
      self.connections().forEach(connection => {
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
  sendMessage(connection, message, messageCount) {
    // serialize the error if exists
    if (message.error) {
      message.error = this.api.config.errors.serializers.servers.websocket(message.error);
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
  sendFile(connection, error, fileStream, mime, length, lastModified) {
    let self = this;

    let content = '';
    let response = {
      error: error,
      content: null,
      mime: mime,
      length: length,
      lastModified: lastModified
    };

    try {
      if (!error) {
        fileStream.on('data', d => {
          content += d;
        });
        fileStream.on('end', () => {
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
  goodbye(connection) {
    connection.rawConnection.end();
  }

  // ------------------------------------------------------------------------------------------------- [PRIVATE METHODS]

  /**
   * Compile client JS.
   *
   * @returns {*}
   * @private
   */
  _compileClientJS() {
    let self = this;

    let clientSource = _fs2.default.readFileSync(`${__dirname}/../client.js`).toString();
    let url = self.api.config.servers.websocket.clientUrl;

    // replace any url by client url
    clientSource = clientSource.replace(/\'%%URL%%\'/g, url);

    let defaults = {};
    for (var i in self.api.config.servers.websocket.client) {
      defaults[i] = self.api.config.servers.websocket.client[i];
    }
    defaults.url = url;

    // append the number of simultaneous connections allowed
    defaults.simultaneousActions = this.api.config.general.simultaneousActions;

    let defaultsString = _util2.default.inspect(defaults);
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
  _renderClientJs(minimize = false) {
    let self = this;

    let libSource = self.server.library();
    let clientSource = self._compileClientJS();

    clientSource = ';;;\r\n' + '(function(exports){ \r\n' + clientSource + '\r\n' + 'exports.StellarClient = StellarClient; \r\n' + '})(typeof exports === \'undefined\' ? window : exports);';

    // minify the client lib code using Uglify
    if (minimize) {
      return _uglifyEs2.default.minify(`${libSource}\r\n\r\n\r\n${clientSource}`).code;
    }

    return `${libSource}\r\n\r\n\r\n${clientSource}`;
  }

  /**
   * Write client js code.
   */
  _writeClientJS() {
    let self = this;

    // ensure the public folder exists
    if (!this.api.utils.directoryExists(`${self.api.config.general.paths.public}`)) {
      this.api.utils.createFolder(`${self.api.config.general.paths.public}`);
    }

    if (self.api.config.servers.websocket.clientJsName) {
      let base = _path2.default.normalize(self.api.config.general.paths.public + _path2.default.sep + self.api.config.servers.websocket.clientJsName);

      try {
        _fs2.default.writeFileSync(`${base}.js`, self._renderClientJs(false));
        self.api.log(`write ${base}.js`, 'debug');
        _fs2.default.writeFileSync(`${base}.min.js`, self._renderClientJs(true));
        self.api.log(`wrote ${base}.min.js`, 'debug');
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
  _handleConnection(rawConnection) {
    const fingerPrint = rawConnection.query[this.api.config.servers.web.fingerprintOptions.cookieKey];

    this.buildConnection({
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
  _handleDisconnection(rawConnection) {
    let self = this;

    for (let i in self.connections()) {
      if (self.connections()[i] && rawConnection.id === self.connections()[i].rawConnection.id) {
        self.connections()[i].destroy();
        break;
      }
    }
  }

  _handleData(connection, data) {
    let verb = data.event;
    delete data.event;

    connection.messageCount++;
    connection.params = {};

    switch (verb) {
      case 'action':
        for (let v in data.params) {
          connection.params[v] = data.params[v];
        }

        connection.error = null;
        connection.response = {};
        this.processAction(connection);
        break;

      case 'file':
        // setup the connection parameters
        connection.params = {
          file: data.file

          // process the file request
        };this.processFile(connection);
        break;

      default:
        let words = [];
        let message;

        if (data.room) {
          words.push(data.room);
          delete data.room;
        }

        for (let i in data) {
          words.push(data[i]);
        }

        connection.verbs(verb, words, (error, data) => {
          // if exists an error, send it to the client
          if (error) {
            message = { status: error, context: 'response', data: data };
            this.sendMessage(connection, message);
            return;
          }

          message = { status: 'OK', context: 'response', data: data };
          this.sendMessage(connection, message);
        });
        break;
    }
  }
}
exports.default = WebSocketServer;