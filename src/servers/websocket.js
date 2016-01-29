import GenericServer from '../genericServer';
import Primus from 'primus';

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
   * Server options.
   *
   * @type {{}}
   */
  options = {};

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
    this.options = options;
  }

  //////////////////// [REQUIRED METHODS]

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

    self.writeClientJS();

    // config event handlers
    this._defineEventHandlers();

    next();
  }

  stop() {
    // todo
    console.log("todo:stop");
  }

  sendMessage() {
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

  writeClientJS() {
    let self = this;

    /*if (!self.api.config.general.paths.public || self.api.config.general.paths.public.length === 0) {
      return;
    }*/

    // todo
    console.log("todo:writeClientJS");
  }

  //////////////////// [PRIVATE METHODS]

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

  _compileActionheroClientJS() {
    // todo
    console.log("todo:_compileActionheroClientJS");
  }

  _renderClientJS() {
    // todo
    console.log("todo:_renderClientJS");
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
