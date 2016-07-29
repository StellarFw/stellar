'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _async = require('async');

var _async2 = _interopRequireDefault(_async);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * This class process an action request.
 */

var ActionProcessor = function () {

  /**
   * Create a new Action Processor instance.
   *
   * @param api API reference.
   * @param connection Connection object.
   * @param callback Callback function.
   */


  /**
   * API reference.
   *
   * @type {null}
   */

  function ActionProcessor(api, connection, callback) {
    _classCallCheck(this, ActionProcessor);

    this.api = null;
    this.connection = null;
    this.action = null;
    this.toProcess = true;
    this.toRender = true;
    this.messageCount = null;
    this.params = null;
    this.callback = null;
    this.missingParams = [];
    this.validatorErrors = [];
    this.actionStartTime = null;
    this.actionTemplate = null;
    this.working = false;
    this.response = {};
    this.duration = null;
    this.actionStatus = null;

    this.api = api;
    this.connection = connection;
    this.messageCount = connection.messageCount;
    this.params = connection.params;
    this.callback = callback;
  }

  /**
   * Increment the total number of executed actions for this connection.
   *
   * @param count
   */


  _createClass(ActionProcessor, [{
    key: 'incrementTotalActions',
    value: function incrementTotalActions() {
      var count = arguments.length <= 0 || arguments[0] === undefined ? 1 : arguments[0];
      this.connection.totalActions += count;
    }

    /**
     * Increment the pending actions for this connection.
     *
     * @param count
     */

  }, {
    key: 'incrementPendingActions',
    value: function incrementPendingActions() {
      var count = arguments.length <= 0 || arguments[0] === undefined ? 1 : arguments[0];
      this.connection.pendingActions += count;
    }

    /**
     * Get the number of pending action for this connection.
     *
     * @returns {number|*}
     */

  }, {
    key: 'getPendingActionCount',
    value: function getPendingActionCount() {
      return this.connection.pendingActions;
    }

    /**
     * Complete the action execution.
     *
     * This essentially logs the action execution status.
     *
     * @param status
     */

  }, {
    key: 'completeAction',
    value: function completeAction(status) {
      var self = this;
      var error = null;

      // define the action status
      self.actionStatus = String(status);

      if (status instanceof Error) {
        error = status;
      } else if (status === 'server_error') {
        error = self.api.config.errors.serverErrorMessage;
      } else if (status === 'server_shutting_down') {
        error = self.api.config.errors.serverShuttingDown;
      } else if (status === 'too_many_requests') {
        error = self.api.config.errors.tooManyPendingActions();
      } else if (status === 'unknown_action') {
        error = self.api.config.errors.unknownAction(self.connection.action);
      } else if (status === 'unsupported_server_type') {
        error = self.api.config.errors.unsupportedServerType(self.connection.type);
      } else if (status === 'missing_params') {
        error = self.api.config.errors.missingParams(self.missingParams);
      } else if (status === 'validator_errors') {
        error = self.api.config.errors.invalidParams(self.validatorErrors);
      } else if (status) {
        error = status;
      }

      if (error && typeof error === 'string') {
        error = new Error(error);
      }

      if (error && !self.response.error) {
        self.response.error = error;
      }

      self.incrementPendingActions(-1);
      self.duration = new Date().getTime() - self.actionStartTime;

      process.nextTick(function () {
        if (typeof self.callback === 'function') {
          self.callback(self);
        }
      });

      self.working = false;
      self.logAction(error);
    }

    /**
     * Log the action execution.
     *
     * @param error
     */

  }, {
    key: 'logAction',
    value: function logAction(error) {
      var self = this;
      var logLevel = 'info';

      // check if the action have a specific log level
      if (self.actionTemplate && self.actionTemplate.logLevel) {
        logLevel = self.actionTemplate.logLevel;
      }

      var filteredParams = {};
      for (var i in self.params) {
        if (self.api.config.general.filteredParams && self.api.config.general.filteredParams.indexOf(i) >= 0) {
          filteredParams[i] = '[FILTERED]';
        } else if (typeof self.params[i] === 'string') {
          filteredParams[i] = self.params[i].substring(0, self.api.config.logger.maxLogStringLength);
        } else {
          filteredParams[i] = self.params[i];
        }
      }

      var logLine = {
        to: self.connection.remoteIP,
        action: self.action,
        params: JSON.stringify(filteredParams),
        duration: self.duration
      };

      if (error) {
        if (error instanceof Error) {
          logLine.error = String(error);
        } else {
          try {
            logLine.error = JSON.stringify(error);
          } catch (e) {
            logLine.error = String(error);
          }
        }
      }

      // log the action execution
      self.api.log('[ action @  ' + self.connection.type + ']', logLevel, logLine);
    }

    /**
     * Operations to be performed before the real action execution.
     *
     * @param callback Callback function.
     */

  }, {
    key: 'preProcessAction',
    value: function preProcessAction(callback) {
      var self = this;

      // if the action is private this can only be executed internally
      if (self.actionTemplate.private === true && self.connection.type !== 'internal') {
        callback(self.api.config.errors.privateActionCalled(self.actionTemplate.name));
        return;
      }

      var processors = [];
      var processorsNames = self.api.actions.globalMiddleware.slice(0);

      // get action processor names
      if (self.actionTemplate.middleware) {
        self.actionTemplate.middleware.forEach(function (m) {
          processorsNames.push(m);
        });
      }

      processorsNames.forEach(function (name) {
        if (typeof self.api.actions.middleware[name].preProcessor === 'function') {
          processors.push(function (next) {
            self.api.actions.middleware[name].preProcessor(self, next);
          });
        }
      });

      _async2.default.series(processors, callback);
    }

    /**
     * Operations to be performed after the action execution.
     *
     * @param callback
     */

  }, {
    key: 'postProcessAction',
    value: function postProcessAction(callback) {
      var self = this;
      var processors = [];
      var processorNames = self.api.actions.globalMiddleware.slice(0);

      if (self.actionTemplate.middleware) {
        self.actionTemplate.middleware.forEach(function (m) {
          processorNames.push(m);
        });
      }

      processorNames.forEach(function (name) {
        if (typeof self.api.actions.middleware[name].postProcessor === 'function') {
          processors.push(function (next) {
            self.api.actions.middleware[name].postProcessor(self, next);
          });
        }
      });

      _async2.default.series(processors, callback);
    }

    /**
     * Validate call params with the action requirements.
     */

  }, {
    key: 'validateParams',
    value: function validateParams() {
      var self = this;

      // iterate inputs definitions of the called action
      for (var key in self.actionTemplate.inputs) {
        // get input properties
        var props = self.actionTemplate.inputs[key];

        // default
        if (self.params[key] === undefined && props.default !== undefined) {
          if (typeof props.default === 'function') {
            self.params[key] = props.default(self.params[key], self);
          } else {
            self.params[key] = props.default;
          }
        }

        // convert
        if (props.convertTo !== undefined) {
          // Function
          if (typeof props.convertTo === 'function') {
            self.params[key] = props.convertTo.call(self.api, self.params[key], self);
          } else if (props.convertTo === 'integer') {
            self.params[key] = Number.parseInt(self.params[key]);
          } else if (props.convertTo === 'float') {
            self.params[key] = Number.parseFloat(self.params[key]);
          } else if (props.convertTo === 'string') {
            self.params[key] = String(self.params[key]);
          }

          if (Number.isNaN(self.params[key])) {
            self.validatorErrors.push(self.api.config.errors.paramInvalidType(key, props.convertTo));
            return;
          }
        }

        // validator
        if (props.validator !== undefined) {
          var validatorResponse = true;

          if (typeof props.validator === 'function') {
            validatorResponse = props.validator.call(self.api, self.params[key], self);
          } else if (typeof props.validator === 'string') {
            validatorResponse = self.api.validator.validate(props.validator, self.params, key);
          } else {
            var pattern = new RegExp(props.validator);
            validatorResponse = pattern.test(self.params[key]) ? true : 'Don\'t match with the validator.';
          }

          // if an error are present add it to the validatorErrors array
          if (validatorResponse !== true) {
            self.validatorErrors.push(validatorResponse);
          }
        }

        // required
        if (props.required === true) {
          if (self.api.config.general.missingParamChecks.indexOf(self.params[key]) >= 0) {
            self.missingParams.push(key);
          }
        }
      }
    }

    /**
     * Process the action.
     */

  }, {
    key: 'processAction',
    value: function processAction() {
      var self = this;

      // initialize the processing environment
      self.actionStartTime = new Date().getTime();
      self.working = true;
      self.incrementTotalActions();
      self.incrementPendingActions();
      self.action = self.params.action;

      if (self.api.actions.versions[self.action]) {
        if (!self.params.apiVersion) {
          self.params.apiVersion = self.api.actions.versions[self.action][self.api.actions.versions[self.action].length - 1];
        }
        self.actionTemplate = self.api.actions.actions[self.action][self.params.apiVersion];
      }

      if (self.api.running !== true) {
        self.completeAction('server_shutting_down');
      } else if (self.getPendingActionCount(self.connection) > self.api.config.general.simultaneousActions) {
        self.completeAction('too_many_requests');
      } else if (!self.action || !self.actionTemplate) {
        self.completeAction('unknown_action');
      } else if (self.actionTemplate.blockedConnectionTypes && self.actionTemplate.blockedConnectionTypes.indexOf(self.connection.type) >= 0) {
        self.completeAction('unsupported_server_type');
      } else {
        try {
          self.runAction();
        } catch (err) {
          self.api.exceptionHandlers.action(err, self, function () {
            return self.completeAction('server_error');
          });
        }
      }
    }

    /**
     * Run an action.
     */

  }, {
    key: 'runAction',
    value: function runAction() {
      var self = this;

      self.preProcessAction(function (error) {
        // validate the request params with the action requirements
        self.validateParams();

        if (error) {
          self.completeAction(error);
        } else if (self.missingParams.length > 0) {
          self.completeAction('missing_params');
        } else if (self.validatorErrors.length > 0) {
          self.completeAction('validator_errors');
        } else if (self.toProcess === true && !error) {
          // execute the action logic
          self.actionTemplate.run(self.api, self, function (error) {
            if (error) {
              self.completeAction(error);
            } else {
              self.postProcessAction(function (error) {
                return self.completeAction(error);
              });
            }
          });
        } else {
          self.completeAction();
        }
      });
    }
  }]);

  return ActionProcessor;
}();

/**
 * Action processor Satellite.
 */


var _class = function () {
  function _class() {
    _classCallCheck(this, _class);

    this.loadPriority = 430;
  }

  /**
   * Initializer load priority.
   *
   * @type {number}
   */


  _createClass(_class, [{
    key: 'load',


    /**
     * Satellite loading function.
     *
     * @param api   API reference object.
     * @param next  Callback function.
     */
    value: function load(api, next) {
      // load action processor to the API
      api.actionProcessor = ActionProcessor;

      // finish the load
      next();
    }
  }]);

  return _class;
}();

exports.default = _class;
//# sourceMappingURL=actionProcessor.js.map
