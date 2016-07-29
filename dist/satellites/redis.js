'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _async = require('async');

var _async2 = _interopRequireDefault(_async);

var _nodeUuid = require('node-uuid');

var _nodeUuid2 = _interopRequireDefault(_nodeUuid);

var _utils = require('../utils');

var _utils2 = _interopRequireDefault(_utils);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Redis manager class.
 *
 * This creates a interface to connect with a redis server.
 */

var RedisManager = function () {

  /**
   * Constructor.
   *
   * @param api API reference.
   */


  /**
   * Subscription handlers.
   *
   * @type {{}}
   */


  /**
   * Callbacks.
   *
   * @type {{}}
   */


  /**
   * API reference.
   *
   * @type {null}
   */

  function RedisManager(api) {
    var _arguments = arguments;

    _classCallCheck(this, RedisManager);

    this.api = null;
    this.clients = {};
    this.clusterCallbacks = {};
    this.clusterCallbackTimeouts = {};
    this.subscriptionHandlers = {};
    this.status = {
      subscribed: false
    };

    var self = this;

    // save api reference object
    self.api = api;

    // subscription handlers

    self.subscriptionHandlers['do'] = function (message) {
      if (!message.connectionId || self.api.connections.connections[message.connectionId]) {
        var cmdParts = message.method.split('.');
        var cmd = cmdParts.shift();
        if (cmd !== 'api') {
          throw new Error('cannot operate on a outside of the api object');
        }
        var method = _utils2.default.stringToHash(api, cmdParts.join('.'));

        var callback = function callback() {
          var responseArgs = Array.apply(null, _arguments).sort();
          process.nextTick(function () {
            self.respondCluster(message.requestId, responseArgs);
          });
        };

        var args = message.args;
        if (args === null) {
          args = [];
        }
        if (!Array.isArray(args)) {
          args = [args];
        }
        args.push(callback);
        method.apply(null, args);
      }
    };

    self.subscriptionHandlers['doResponse'] = function (message) {
      if (self.clusterCallbacks[message.requestId]) {
        clearTimeout(self.clusterCallbackTimeouts[message.requestId]);
        self.clusterCallbacks[message.requestId].apply(null, message.response);
        delete self.clusterCallbacks[message.requestId];
        delete self.clusterCallbackTimeouts[message.requestId];
      }
    };
  }

  /**
   * Redis manager status.
   *
   * @type {{subscribed: boolean}}
   */


  /**
   * Cluster callback timeouts.
   *
   * @type {{}}
   */


  /**
   * Hash with all instantiate clients.
   *
   * @type {{}}
   */


  _createClass(RedisManager, [{
    key: 'initialize',
    value: function initialize(callback) {
      var self = this;

      var jobs = [];

      ['client', 'subscriber', 'tasks'].forEach(function (r) {
        jobs.push(function (done) {
          if (self.api.config.redis[r].buildNew === true) {
            // get arguments
            var args = self.api.config.redis[r].args;

            // create a new instance
            self.clients[r] = new self.api.config.redis[r].constructor(args[0], args[1], args[2]);

            // on error event
            self.clients[r].on('error', function (error) {
              self.api.log('Redis connection ' + r + ' error', error);
            });

            // on connect event
            self.clients[r].on('connect', function () {
              self.api.log('Redis connection ' + r + ' connected', 'info');
              done();
            });
          } else {
            self.clients[r] = self.api.config.redis[r].constructor.apply(null, self.api.config.redis[r].args);
            self.clients[r].on('error', function (error) {
              self.api.log('Redis connection ' + r + ' error', 'error', error);
            });
            self.api.log('Redis connection ' + r + ' connected', 'info');
            done();
          }
        });
      });

      if (!self.status.subscribed) {
        jobs.push(function (done) {
          // ensures that clients subscribe the default channel
          self.clients.subscriber.subscribe(self.api.config.general.channel);
          self.status.subscribed = true;

          // on 'message' event execute the handler
          self.clients.subscriber.on('message', function (messageChannel, message) {
            // parse the JSON message if exists
            try {
              message = JSON.parse(message);
            } catch (e) {
              message = {};
            }

            if (messageChannel === self.api.config.general.channel && message.serverToken === self.api.config.general.serverToken) {
              if (self.subscriptionHandlers[message.messageType]) {
                self.subscriptionHandlers[message.messageType](message);
              }
            }
          });

          // execute the callback
          done();
        });
      }

      _async2.default.series(jobs, callback);
    }

    /**
     * Publish a payload to the redis server.
     *
     * @param payload Payload to be published.
     */

  }, {
    key: 'publish',
    value: function publish(payload) {
      var self = this;

      // get default Redis channel
      var channel = self.api.config.general.channel;

      // publish redis message
      self.clients.client.publish(channel, JSON.stringify(payload));
    }

    // ------------------------------------------------------------------------------------------------------------- [RPC]

  }, {
    key: 'doCluster',
    value: function doCluster(method, args, connectionId, callback) {
      var self = this;

      var requestId = _nodeUuid2.default.v4();
      var payload = {
        messageType: 'do',
        serverId: self.api.id,
        serverToken: self.api.config.general.serverToken,
        requestId: requestId,
        method: method,
        connectionId: connectionId,
        args: args
      };

      self.publish(payload);

      if (typeof callback === 'function') {
        self.clusterCallbacks[requestId] = callback;
        self.clusterCallbackTimeouts[requestId] = setTimeout(function (requestId) {
          if (typeof self.clusterCallbacks[requestId] === 'function') {
            self.clusterCallbacks[requestId](new Error('RPC Timeout'));
          }
          delete self.clusterCallbacks[requestId];
          delete self.clusterCallbackTimeouts[requestId];
        }, self.api.config.general.rpcTimeout, requestId);
      }
    }
  }, {
    key: 'respondCluster',
    value: function respondCluster(requestId, response) {
      var self = this;

      var payload = {
        messageType: 'doResponse',
        serverId: self.api.id,
        serverToken: self.api.config.general.serverToken,
        requestId: requestId,
        response: response // args to pass back, including error
      };

      self.publish(payload);
    }
  }]);

  return RedisManager;
}();

/**
 * Redis initializer.
 */


var _class = function () {
  function _class() {
    _classCallCheck(this, _class);

    this.loadPriority = 200;
    this.stopPriority = 999;
  }

  /**
   * Initializer load priority.
   *
   * @type {number}
   */


  /**
   * Initializer stop priority.
   *
   * @type {number}
   */


  _createClass(_class, [{
    key: 'load',


    /**
     * Initializer load method.
     *
     * @param api   API reference.
     * @param next  Callback
     */
    value: function load(api, next) {
      // put the redis manager available
      api.redis = new RedisManager(api);

      // initialize redis manager
      api.redis.initialize(function (error) {
        // execute the callback if exists an error
        if (error) {
          return next(error);
        }

        api.redis.doCluster('api.log', 'Stellar member ' + api.id + ' has joined the cluster', null, null);

        // finish the loading
        process.nextTick(next);
      });
    }

    /**
     * Stop initializer.
     *
     * @param api   API reference.
     * @param next  Callback.
     */

  }, {
    key: 'stop',
    value: function stop(api, next) {
      // execute all existent timeouts and remove them
      for (var i in api.redis.clusterCallbackTimeouts) {
        clearTimeout(api.redis.clusterCallbackTimeouts[i]);
        delete api.redis.clusterCallbakTimeouts[i];
        delete api.redis.clusterCallbaks[i];
      }

      // inform the cluster of stellar leaving
      api.redis.doCluster('api.log', 'Stellar member ' + api.id + ' has left the cluster', null, null);

      // unsubscribe stellar instance and finish the stop method execution
      process.nextTick(function () {
        api.redis.clients.subscriber.unsubscribe();
        api.redis.status.subscribed = false;
        next();
      });
    }
  }]);

  return _class;
}();

exports.default = _class;
//# sourceMappingURL=redis.js.map
