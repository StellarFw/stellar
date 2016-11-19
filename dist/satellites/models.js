'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _mongoose = require('mongoose');

var _mongoose2 = _interopRequireDefault(_mongoose);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

/**
 * Manage the models.
 */
class Models {

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
  constructor(api) {
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
  openConnection(callback) {
    let self = this;

    // if the connection has already open return and execute the callback
    if (self.status()) {
      return callback(new Error('Connection is already open'));
    }

    // hack: this fix a strange bug on the test environment
    if (self.api.env === 'test' && _mongoose2.default.connections[0]._hasOpened === true) {
      // save the mongoose instance
      self.mongoose = _mongoose2.default;

      // mark mongoose was connected
      self.connected = true;

      // execute the callback function and return
      return callback();
    }

    let connectCallback = () => {
      // save mongoose object
      self.mongoose = _mongoose2.default;

      // set mongoose to use native ES6 promises
      _mongoose2.default.Promise = global.Promise;

      // open the new connection
      self.mongoose.connect(self.api.config.models.connectionString, error => {
        if (error) {
          return self.api.log(`MongoDB Error: ${ error }`, 'emerg');
        }

        self.api.log('connected to MongoDB', 'debug');
        self.connected = true;
        callback();
      });

      // define handler for disconnected event
      self.mongoose.connection.on('disconnected', () => {
        self.connected = false;
        self.api.log('MongoDB Connection Closed', 'debug');
      });
    };

    // check if we are use a mock version of the package
    if (self.api.config.models.pkg === 'mockgoose') {
      // require mockgoose
      let mockgoose = require('mockgoose');

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
  closeConnection(callback) {
    let self = this;

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
  status() {
    return this.connected;
  }

  /**
   * Add a new model.
   *
   * If the model already exists it will be replaced.
   *
   * @param name    Model name.
   * @param schema  Model schema.
   */
  add(name, schema) {
    var _this = this;

    return _asyncToGenerator(function* () {
      // if the model already exists that can't be overwrite
      if (_this.models.has(name)) {
        return;
      }

      // the schema definition can be a function, pass the api reference and
      // the mongoose object
      if (typeof schema === 'function') {
        schema = schema(_this.api, _mongoose2.default);
      }

      // execute the add event
      let eventObj = { schema, mongoose: _this.mongoose };
      const response = yield _this.api.events.fire(`core.models.add.${ name }`, eventObj);

      // save the new model instance
      _this.models.set(name, _this.mongoose.model(name, response.schema));
    })();
  }

  /**
   * Get a model object from the repository.
   *
   * @param modelName   model name to get.
   * @returns {V}       model object.
   */
  get(modelName) {
    return this.models.get(modelName);
  }

  /**
   * Remove a model from the repository.
   *
   * @param modelName   model name to be deleted.
   */
  remove(modelName) {
    this.models.delete(modelName);
  }

}

/**
 * Initializer for the models features.
 */
exports.default = class {
  constructor() {
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


  /**
   * Initializer loading function.
   *
   * @param api   API reference.
   * @param next  Callback function.
   */
  load(api, next) {
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
  start(api, next) {
    // cleanup mongoose cache
    _mongoose2.default.models = {};
    _mongoose2.default.modelSchemas = {};

    // open connection
    api.models.openConnection(() => {
      // read models files from the modules
      api.modules.modulesPaths.forEach(modulePath => {
        api.utils.recursiveDirectoryGlob(`${ modulePath }/models`).forEach(moduleFile => {
          // get file basename
          let basename = _path2.default.basename(moduleFile, '.js');

          // load the model
          api.models.add(basename, require(moduleFile).default);

          // log a message
          api.log(`model loaded: ${ basename }`, 'debug');
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
  stop(api, next) {
    // close connection
    api.models.closeConnection(next);
  }
};