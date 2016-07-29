'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _os = require('os');

var _os2 = _interopRequireDefault(_os);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var ExceptionsManager = function () {

  /**
   * API reference.
   *
   * @type {null}
   */

  function ExceptionsManager(api) {
    _classCallCheck(this, ExceptionsManager);

    this.api = null;
    this.reporters = [];

    this.api = api;

    // load default console handler
    this.reporters.push(function (err, type, name, objects, severity) {
      var extraMessages = [];

      if (type === 'loader') {
        extraMessages.push('! Failed to load ' + objects.fullFilePath);
      } else if (type === 'action') {
        extraMessages.push('! uncaught error from action: ' + name);
        extraMessages.push('! connection details:');
        var relevantDetails = ['action', 'remoteIP', 'type', 'params', 'room'];
        for (var i in relevantDetails) {
          if (objects.connection[relevantDetails[i]] !== null && objects.connection[relevantDetails[i]] !== undefined && typeof objects.connection[relevantDetails[i]] !== 'function') {
            extraMessages.push('!     ' + relevantDetails[i] + ': ' + JSON.stringify(objects.connection[relevantDetails[i]]));
          }
        }
      } else if (type === 'task') {
        extraMessages.push('! uncaught error from task: ' + name + ' on queue ' + objects.queue + ' (worker #' + objects.workerId + ')');
        try {
          extraMessages.push('!     arguments: ' + JSON.stringify(objects.task.args));
        } catch (e) {}
      } else {
        extraMessages.push('! Error: ' + err.message);
        extraMessages.push('!     Type: ' + type);
        extraMessages.push('!     Name: ' + name);
        extraMessages.push('!     Data: ' + JSON.stringify(objects));
      }

      for (var m in extraMessages) {
        api.log(extraMessages[m], severity);
      }
      var lines = void 0;
      try {
        lines = err.stack.split(_os2.default.EOL);
      } catch (e) {
        lines = new Error(err).stack.split(_os2.default.EOL);
      }
      for (var l in lines) {
        var line = lines[l];
        api.log('! ' + line, severity);
      }
      api.log('*', severity);
    });
  }

  /**
   * Execute reporters.
   *
   * @param err
   * @param type
   * @param name
   * @param objects
   * @param severity
   */


  /**
   * Array with the exceptions reporters.
   *
   * @type {Array}
   */


  _createClass(ExceptionsManager, [{
    key: 'report',
    value: function report(err, type, name, objects, severity) {
      var self = this;

      if (!severity) {
        severity = 'error';
      }

      for (var i in self.reporters) {
        self.reporters[i](err, type, name, objects, severity);
      }
    }

    /**
     * Loader exception.
     *
     * @param fullFilePath
     * @param err
     */

  }, {
    key: 'loader',
    value: function loader(fullFilePath, err) {
      var self = this;
      var name = 'loader ' + fullFilePath;
      self.report(err, 'loader', name, { fullFilePath: fullFilePath }, 'alert');
    }

    /**
     * Handler for action exceptions.
     *
     * @param err
     * @param data
     * @param next
     */

  }, {
    key: 'action',
    value: function action(err, data, next) {
      var self = this;
      var simpleName = void 0;

      try {
        simpleName = data.action;
      } catch (e) {
        simpleName = err.message;
      }

      var name = 'action ' + simpleName;
      self.report(err, 'action', name, { connection: data.connection }, 'error');
      // remove already processed responses
      data.response = {};
      if (typeof next === 'function') {
        next();
      }
    }

    /**
     * Exception handler for tasks.
     *
     * @param error       Error object.
     * @param queue       Queue here the error occurs
     * @param task
     * @param workerId
     */

  }, {
    key: 'task',
    value: function task(error, queue, _task, workerId) {
      var self = this;

      var simpleName = void 0;

      try {
        simpleName = _task['class'];
      } catch (e) {
        simpleName = error.message;
      }

      self.api.exceptionHandlers.report(error, 'task', 'task:' + simpleName, name, {
        task: _task,
        queue: queue,
        workerId: workerId
      }, self.api.config.tasks.workerLogging.failure);
    }
  }]);

  return ExceptionsManager;
}();

var _class = function () {
  function _class() {
    _classCallCheck(this, _class);

    this.loadPriority = 130;
  }

  _createClass(_class, [{
    key: 'load',
    value: function load(api, next) {
      api.exceptionHandlers = new ExceptionsManager(api);
      next();
    }
  }]);

  return _class;
}();

exports.default = _class;
//# sourceMappingURL=exceptions.js.map
