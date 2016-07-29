'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _utils = require('../utils');

var _utils2 = _interopRequireDefault(_utils);

var _mongoose = require('mongoose');

var _mongoose2 = _interopRequireDefault(_mongoose);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Manage the models.
 */

var Models = function () {

  /**
   * Create a new Models call instance.
   *
   * @param api   API reference.
   */


  /**
   * Connection status.
   *
   * @type {boolean}
   */


  /**
   * Reference for the API object.
   *
   * @type {null}
   */

  function Models(api) {
    _classCallCheck(this, Models);

    this.api = null;
    this.mongoose = null;
    this.connected = false;
    this.models = new Map();

    this.api = api;
  }

  /**
   * Open connection to MongoDB server.
   *
   * @param callback  Callback function.
   */


  /**
   * Hash with all registered models.
   *
   * @type {Map}
   */


  /**
   * Mongoose object.
   *
   * @type {null}
   */


  _createClass(Models, [{
    key: 'openConnection',
    value: function openConnection(callback) {
      var self = this;

      // if the connection has already open return and execute the callback
      if (self.status()) {
        callback(new Error('Connection is already open'));
        return;
      }

      // hack: this fix a strange bug on the test environment
      if (self.api.env === 'test' && _mongoose2.default.connections[0]._hasOpened === true) {
        // save the mongoose instance
        self.mongoose = _mongoose2.default;

        // mark mongoose was connected
        self.connected = true;

        // execute the callback function and return
        callback();
        return;
      }

      var connectCallback = function connectCallback() {
        // save mongoose object
        self.mongoose = _mongoose2.default;

        // open the new connection
        self.mongoose.connect(self.api.config.models.connectionString, function (error) {
          if (error) {
            self.api.log('MongoDB Error: ' + err, 'emerg');
            return;
          }

          self.api.log('connected to MongoDB', 'debug');
          self.connected = true;
          callback();
        });

        // define handler for disconnected event
        self.mongoose.connection.on('disconnected', function () {
          self.connected = false;
          self.api.log('MongoDB Connection Closed', 'debug');
        });
      };

      // check if we are use a mock version of the package
      if (self.api.config.models.pkg === 'mockgoose') {
        // require mockgoose
        var mockgoose = require('mockgoose');

        // wrap mongoose with mockgoose
        mockgoose(_mongoose2.default).then(connectCallback);

        // log an warning
        self.api.log('running with mockgoose', 'warning');
      } else {
        connectCallback();
      }
    }

    /**
     * Close connection.
     *
     * @param callback  Callback function.
     */

  }, {
    key: 'closeConnection',
    value: function closeConnection(callback) {
      var self = this;

      // if there is not connection open return now
      if (!self.status()) {
        callback(new Error('There is no connection open'));
        return;
      }

      self.mongoose.connection.close(callback);
    }

    /**
     * Return the connection status.
     *
     * @returns {boolean}
     */

  }, {
    key: 'status',
    value: function status() {
      return this.connected;
    }

    /**
     * Add a new model.
     *
     * If the model already exists it will be replaced.
     *
     * @param name    Model name
     * @param schema  Model schema.
     */

  }, {
    key: 'add',
    value: function add(name, schema) {
      // if the model already exists that can't be overwrite
      if (this.models.has(name)) {
        return;
      }

      // save the new model instance
      this.models.set(name, this.mongoose.model(name, schema));
    }

    /**
     * Get a model object from the repository.
     *
     * @param modelName   model name to get.
     * @returns {V}       model object.
     */

  }, {
    key: 'get',
    value: function get(modelName) {
      return this.models.get(modelName);
    }

    /**
     * Remove a model from the repository.
     *
     * @param modelName   model name to be deleted.
     */

  }, {
    key: 'remove',
    value: function remove(modelName) {
      this.models.delete(modelName);
    }
  }]);

  return Models;
}();

/**
 * Initializer for the models features.
 */


var _class = function () {
  function _class() {
    _classCallCheck(this, _class);

    this.loadPriority = 100;
    this.startPriority = 100;
    this.stopPriority = 400;
  }

  /**
   * Initializer load priority.
   *
   * @type {number}
   */


  /**
   * Initializer start priority.
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
     * Initializer loading function.
     *
     * @param api   API reference.
     * @param next  Callback function.
     */
    value: function load(api, next) {
      // expose models class on the engine
      api.models = new Models(api);

      // finish the initializer loading
      next();
    }

    /**
     * Initializer start function.
     *
     * @param api   API reference.
     * @param next  Callback function.
     */

  }, {
    key: 'start',
    value: function start(api, next) {
      // cleanup mongoose cache
      _mongoose2.default.models = {};
      _mongoose2.default.modelSchemas = {};

      // open connection
      api.models.openConnection(function () {
        // read models files from the modules
        api.modules.modulesPaths.forEach(function (modulePath) {
          _utils2.default.recursiveDirectoryGlob(modulePath + '/models').forEach(function (moduleFile) {
            // get file basename
            var basename = _path2.default.basename(moduleFile, '.js');

            // load the model
            api.models.add(basename, require(moduleFile).default);

            // log a message
            api.log('model loaded: ' + basename, 'debug');
          });
        });

        // finish the initializer start
        next();
      });
    }

    /**
     * Initializer stop function.
     *
     * @param api   API reference.
     * @param next  Callback function.
     */

  }, {
    key: 'stop',
    value: function stop(api, next) {
      // close connection
      api.models.closeConnection(next);
    }
  }]);

  return _class;
}();

exports.default = _class;
//# sourceMappingURL=models.js.map
