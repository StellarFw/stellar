import fs from 'fs';
import util from 'util';
import path from 'path';
import Primus from 'primus';
import UglifyJS from 'uglify-js';
import GenericServer from '../genericServer';

// server type
let type = 'websocket';

// server attributes
let attributes = {
  logConnections: true,
  logExists: true,
  sendWelcomeMessage: true,
  verbs: [
    'quit',
    'exit',
    'documentation',
    'roomAdd',
    'roomLeave',
    'roomView',
    'detailsView',
    'say'
  ]
};

export default class WebSocketServer extends GenericServer {

  /**
   * Engine interface object.
   *
   * @type {null}
   */
  api = null;

  /**
   * Server instance.
   */
  server;

  /**
   * Creates a new server instance.
   *
   * @param api stellar engine interface.
   * @param options sever options.
   */
  constructor(api, options) {
    super(api, type, options, attributes);

    this.api = api;
  }

  // ------------------------------------------------------------------------------------------------ [REQUIRED METHODS]

  /**
   * Start the server
   *
   * @param next
   */
  start(next) {
    let self = this;
    let webserver = self.api.servers.servers.web;

    // create a new primus instance
    self.server = new Primus(webserver.server, self.api.config.servers.websocket.server);

    // define some event handlers
    self.server.on('connection', function (rawConnection) {
      self._handleConnection(rawConnection);
    });

    self.server.on('disconnection', function (rawConnection) {
      self._handleDisconnection(rawConnection);
    });

    self.api.log(`webSocket bound to ${webserver.options.bindIP}:${webserver.options.port}`, 'debug');
    self.server.active = true;

    // config event handlers
    this._defineEventHandlers();

    // write client js
    self._writeClientJS();

    // execute the callback
    next();
  }

  /**
   * Shutdown the websocket server.
   *
   * @param next Callback
   */
  stop(next) {
    let self = this;

    // disable the server
    self.active = false;

    // destroy clients connections
    if (self.api.config.servers.websocket.destroyClientOnShutdown === true) {
      self.connections().forEach((connection) => {
        connection.destroy();
      });
    }

    // execute the callback on the next tick
    process.nextTick(() => {
      next();
    });
  }

  sendMessage(connection, message, messageCount) {
    // todo
    console.log("todo:sendMessage");
  }

  sendFile() {
    // todo
    console.log("todo:sendFile");
  }

  goodbye() {
    // todo
    console.log("todo:goodbye");
  }

  //////////////////// [PRIVATE METHODS]

  _compileActionheroClientJS() {
    let self = this;

    let clientSource = fs.readFileSync(__dirname + '/../client.js').toString();
    let url = self.api.config.servers.websocket.clientUrl;

    // replace any url by client url
    clientSource = clientSource.replace(/%%URL%%/g, url);

    let defaults = {};
    for (var i in self.api.config.servers.websocket.client) {
      defaults[i] = self.api.config.servers.websocket.client[i];
    }
    defaults.url = url;

    let defaultsString = util.inspect(defaults);
    defaultsString = defaultsString.replace('\'window.location.origin\'', 'window.location.origin');
    clientSource = clientSource.replace('%%DEFAULTS%%', 'return ' + defaultsString);

    return clientSource;
  }

  _renderClientJs(minimize = false) {
    let self = this;

    let libSource = self.api.servers.servers.websocket.server.library();
    let clientSource = self._compileActionheroClientJS();

    clientSource =
      ';;;\r\n' +
      '(function(exports){ \r\n' +
      clientSource +
      '\r\n' +
      'exports.StellarClient = StellarClient; \r\n' +
      '})(typeof exports === \'undefined\' ? window : exports);';

    if (minimize) {
      return UglifyJS.minify(`${libSource}\r\n\r\n\r\n${clientSource}`, {fromString: true}).code;
    } else {
      return `${libSource}\r\n\r\n\r\n${clientSource}`;
    }
  }

  /**
   * Write client js code.
   */
  _writeClientJS() {
    let self = this;

    if (self.api.config.servers.websocket.clientJsPath && self.api.config.servers.websocket.clientJsName) {
      let base = path.normalize(
        self.api.config.general.paths.temp + path.sep +
        self.api.config.servers.websocket.clientJsName);

      try {
        fs.writeFileSync(`${base}.js`, self._renderClientJs(false));
        self.api.log(`write ${base}.js`, 'debug');
        fs.writeFileSync(`${base}.min.js`, self._renderClientJs(true));
        self.api.log(`wrote ${base}.min.js`, 'debug');
      } catch (e) {
        self.api.log(`Cannot write client-side JS for websocket server:`, 'warning');
        self.api.log(e, 'warning');
        throw e;
      }
    }
  }

  _handleConnection() {
    // todo
    console.log("todo:_handleConnection");
  }

  _handleDisconnection() {
    // todo
    console.log("todo:_handleDisconnection");
  }

  _handleData() {
    // todo
    console.log("todo:_handleData");
  }

  /**
   * Define event handlers.
   *
   * @private
   */
  _defineEventHandlers() {
    let self = this;

    self.server.on('connection', function (connection) {
      connection.rawConnection.on('data', function (data) {
        self._handleData(connection, data);
      });
    });

    self.server.on('actionComplete', function (data) {
      if (data.toRender !== false) {
        data.connection.response.messageCount = data.messageCount;
        self.sendMessage(data.connection, data.response, data.message());
      }
    });
  }

}
