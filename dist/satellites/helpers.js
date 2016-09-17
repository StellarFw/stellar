'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _nodeUuid = require('node-uuid');

var _nodeUuid2 = _interopRequireDefault(_nodeUuid);

var _genericServer = require('../genericServer');

var _genericServer2 = _interopRequireDefault(_genericServer);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var TestServer = function (_GenericServer) {
  _inherits(TestServer, _GenericServer);

  function TestServer(api, type, options, attributes) {
    _classCallCheck(this, TestServer);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(TestServer).call(this, api, type, options, attributes));

    _this.on('connection', function (connection) {
      connection.messages = [];
      connection.actionCallbacks = {};
    });

    _this.on('actionComplete', function (data) {
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
        _this.sendMessage(data.connection, data.response, data.messageCount);
      }
    });
    return _this;
  }

  _createClass(TestServer, [{
    key: 'start',
    value: function start(next) {
      this.api.log('loading the testServer', 'warning');
      next();
    }
  }, {
    key: 'stop',
    value: function stop(next) {
      next();
    }
  }, {
    key: 'sendMessage',
    value: function sendMessage(connection, message, messageCount) {
      process.nextTick(function () {
        message.messageCount = messageCount;
        connection.messages.push(message);

        if (typeof connection.actionCallbacks[messageCount] === 'function') {
          connection.actionCallbacks[messageCount](message, connection);
          delete connection.actionCallbacks[messageCount];
        }
      });
    }
  }, {
    key: 'goodbye',
    value: function goodbye() {}
  }]);

  return TestServer;
}(_genericServer2.default);

var Helpers = function () {

  /**
   * Create a new instance of Helpers class.
   *
   * @param api
   */
  function Helpers(api) {
    _classCallCheck(this, Helpers);

    this.api = null;
    this.api = api;
  }

  /**
   * API reference object.
   *
   * @type {null}
   */


  _createClass(Helpers, [{
    key: 'connection',
    value: function connection() {
      var self = this;
      var id = _nodeUuid2.default.v4();

      self.api.servers.servers.testServer.buildConnection({
        id: id,
        rawConnection: {},
        remoteAddress: 'testServer',
        remotePort: 0
      });

      return self.api.connections.connections[id];
    }
  }, {
    key: 'initialize',
    value: function initialize(api, options, next) {
      var type = 'testServer';
      var attributes = {
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

  }, {
    key: 'runAction',
    value: function runAction(actionName, input, next) {
      var self = this;
      var connection = void 0;

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

      process.nextTick(function () {
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

  }, {
    key: 'runTask',
    value: function runTask(taskName, params, next) {
      var self = this;
      self.api.tasks.tasks[taskName].run(self.api, params, next);
    }
  }]);

  return Helpers;
}();

var _class = function () {
  function _class() {
    _classCallCheck(this, _class);

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


  _createClass(_class, [{
    key: 'load',


    /**
     * Satellite loading function.
     *
     * @param api   API object reference.
     * @param next  Callback function.
     */
    value: function load(api, next) {
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

  }, {
    key: 'start',
    value: function start(api, next) {
      if (api.env === 'test') {
        api.helpers.initialize(api, {}, function (serverObject) {
          api.servers.servers.testServer = serverObject;
          api.servers.servers.testServer.start(function () {
            return next();
          });
        });

        return;
      }

      // finish the satellite start
      next();
    }
  }]);

  return _class;
}();

exports.default = _class;