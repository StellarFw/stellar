'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _nodeUuid = require('node-uuid');

var _nodeUuid2 = _interopRequireDefault(_nodeUuid);

var _genericServer = require('../genericServer');

var _genericServer2 = _interopRequireDefault(_genericServer);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class TestServer extends _genericServer2.default {

  constructor(api, type, options, attributes) {
    super(api, type, options, attributes);

    this.on('connection', connection => {
      connection.messages = [];
      connection.actionCallbacks = {};
    });

    this.on('actionComplete', data => {
      data.response.messageCount = data.messageCount;
      data.response.serverInformation = {
        serverName: api.config.general.serverName,
        apiVersion: api.config.general.apiVersion
      };

      data.response.requesterInformation = {
        id: data.connection.id,
        remoteIP: data.connection.remoteIP,
        receivedParams: {}
      };

      if (data.response.error) {
        data.response.error = api.config.errors.serializers.servers.helper(data.response.error);
      }

      for (var k in data.params) {
        data.response.requesterInformation.receivedParams[k] = data.params[k];
      }

      if (data.toRender === true) {
        this.sendMessage(data.connection, data.response, data.messageCount);
      }
    });
  }

  start(next) {
    this.api.log('loading the testServer', 'warning');
    next();
  }

  stop(next) {
    next();
  }

  sendMessage(connection, message, messageCount) {
    process.nextTick(() => {
      message.messageCount = messageCount;
      connection.messages.push(message);

      if (typeof connection.actionCallbacks[messageCount] === 'function') {
        connection.actionCallbacks[messageCount](message, connection);
        delete connection.actionCallbacks[messageCount];
      }
    });
  }

  goodbye() {}

}

class Helpers {

  /**
   * Create a new instance of Helpers class.
   *
   * @param api
   */
  constructor(api) {
    this.api = null;
    this.api = api;
  }

  /**
   * API reference object.
   *
   * @type {null}
   */


  connection() {
    let self = this;
    let id = _nodeUuid2.default.v4();

    self.api.servers.servers.testServer.buildConnection({
      id: id,
      rawConnection: {},
      remoteAddress: 'testServer',
      remotePort: 0
    });

    return self.api.connections.connections[id];
  }

  initialize(api, options, next) {
    let type = 'testServer';
    let attributes = {
      canChat: true,
      logConnections: false,
      logExits: false,
      sendWelcomeMessage: true,
      verbs: api.connections.allowedVerbs
    };

    next(new TestServer(api, type, options, attributes));
  }

  /**
   * Run an action.
   *
   * This creates a fake connection to process the action
   * and return the result on the callback function.
   *
   * @param actionName  Action to be executed.
   * @param input       Action parameters.
   * @param next        Callback function.
   */
  runAction(actionName, input, next) {
    let self = this;
    let connection;

    if (typeof input === 'function' && !next) {
      next = input;
      input = {};
    }

    if (input.id && input.type === 'testServer') {
      connection = input;
    } else {
      connection = self.connection();
      connection.params = input;
    }
    connection.params.action = actionName;

    connection.messageCount++;
    if (typeof next === 'function') {
      connection.actionCallbacks[connection.messageCount] = next;
    }

    process.nextTick(() => {
      self.api.servers.servers.testServer.processAction(connection);
    });
  }

  /**
   * Execute a task.
   *
   * @param taskName  Task to be executed.
   * @param params    Task parameters.
   * @param next      Callback function.
   */
  runTask(taskName, params, next) {
    let self = this;
    self.api.tasks.tasks[taskName].run(self.api, params, next);
  }
}

exports.default = class {
  constructor() {
    this.loadPriority = 800;
    this.startPriority = 800;
  }

  /**
   * Satellite load priority.
   *
   * @type {number}
   */


  /**
   * Satellite start priority.
   *
   * @type {number}
   */


  /**
   * Satellite loading function.
   *
   * @param api   API object reference.
   * @param next  Callback function.
   */
  load(api, next) {
    if (api.env === 'test') {
      // put the helpers available to all platform
      api.helpers = new Helpers(api);
    }

    // finish the satellite load
    next();
  }

  /**
   * Satellite starting function.
   *
   * @param api   API object reference.
   * @param next  Callback function.
   */
  start(api, next) {
    if (api.env === 'test') {
      api.helpers.initialize(api, {}, serverObject => {
        api.servers.servers.testServer = serverObject;
        api.servers.servers.testServer.start(() => next());
      });

      return;
    }

    // finish the satellite start
    next();
  }

};