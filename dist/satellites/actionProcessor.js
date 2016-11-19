'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _async = require('async');

var _async2 = _interopRequireDefault(_async);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * This class process an action request.
 */
class ActionProcessor {

  /**
   * Create a new Action Processor instance.
   *
   * @param api API reference.
   * @param connection Connection object.
   * @param callback Callback function.
   */
  constructor(api, connection, callback) {
    this.api = null;
    this.connection = null;
    this.action = null;
    this.toProcess = true;
    this.toRender = true;
    this.messageCount = null;
    this.params = null;
    this.callback = null;
    this.validatorErrors = new Map();
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


  /**
   * API reference.
   *
   * @type {null}
   */
  incrementTotalActions(count = 1) {
    this.connection.totalActions += count;
  }

  /**
   * Increment the pending actions for this connection.
   *
   * @param count
   */
  incrementPendingActions(count = 1) {
    this.connection.pendingActions += count;
  }

  /**
   * Get the number of pending action for this connection.
   *
   * @returns {number|*}
   */
  getPendingActionCount() {
    return this.connection.pendingActions;
  }

  /**
   * Complete the action execution.
   *
   * This essentially logs the action execution status.
   *
   * @param status
   */
  completeAction(status) {
    let self = this;
    let error = null;

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
  logAction(error) {
    let self = this;
    let logLevel = 'info';

    // check if the action have a specific log level
    if (self.actionTemplate && self.actionTemplate.logLevel) {
      logLevel = self.actionTemplate.logLevel;
    }

    let filteredParams = {};
    for (let i in self.params) {
      if (self.api.config.general.filteredParams && self.api.config.general.filteredParams.indexOf(i) >= 0) {
        filteredParams[i] = '[FILTERED]';
      } else if (typeof self.params[i] === 'string') {
        filteredParams[i] = self.params[i].substring(0, self.api.config.logger.maxLogStringLength);
      } else {
        filteredParams[i] = self.params[i];
      }
    }

    let logLine = {
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
    self.api.log(`[ action @  ${ self.connection.type }]`, logLevel, logLine);
  }

  /**
   * Operations to be performed before the real action execution.
   *
   * @param callback Callback function.
   */
  preProcessAction(callback) {
    let self = this;

    // if the action is private this can only be executed internally
    if (self.actionTemplate.private === true && self.connection.type !== 'internal') {
      callback(self.api.config.errors.privateActionCalled(self.actionTemplate.name));
      return;
    }

    let processors = [];
    let processorsNames = self.api.actions.globalMiddleware.slice(0);

    // get action processor names
    if (self.actionTemplate.middleware) {
      self.actionTemplate.middleware.forEach(m => {
        processorsNames.push(m);
      });
    }

    processorsNames.forEach(name => {
      if (typeof self.api.actions.middleware[name].preProcessor === 'function') {
        processors.push(next => {
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
  postProcessAction(callback) {
    let self = this;
    let processors = [];
    let processorNames = self.api.actions.globalMiddleware.slice(0);

    if (self.actionTemplate.middleware) {
      self.actionTemplate.middleware.forEach(m => {
        processorNames.push(m);
      });
    }

    processorNames.forEach(name => {
      if (typeof self.api.actions.middleware[name].postProcessor === 'function') {
        processors.push(next => {
          self.api.actions.middleware[name].postProcessor(self, next);
        });
      }
    });

    _async2.default.series(processors, callback);
  }

  /**
   * Validate call params with the action requirements.
   */
  validateParams() {
    let self = this;

    // hash who contains all the field to be validated
    const toValidate = {};

    // iterate inputs definitions of the called action
    for (let key in self.actionTemplate.inputs) {
      // get input properties
      let props = self.actionTemplate.inputs[key];

      // default
      if (self.params[key] === undefined && props.default !== undefined) {
        if (typeof props.default === 'function') {
          self.params[key] = props.default(self.params[key], self);
        } else {
          self.params[key] = props.default;
        }
      }

      // convert
      if (props.convertTo && this.params[key]) {
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
          self.validatorErrors.set(key, self.api.config.errors.paramInvalidType(key, props.convertTo));
        }
      }

      // convert the required property to a validator to unify the validation
      // system
      if (props.required === true) {
        props.validator = !props.validator ? 'required' : 'required|' + props.validator;
      }

      // add the field to the validation hash
      if (props.validator) {
        toValidate[key] = props.validator;
      }
    }

    // execute all validators. If there is found some error on the validations,
    // the error map must be attributed to `validatorErrors`
    let response = this.api.validator.validate(self.params, toValidate);
    if (response !== true) {
      self.validatorErrors = response;
    }
  }

  /**
   * Process the action.
   */
  processAction() {
    let self = this;

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
        self.api.exceptionHandlers.action(err, self, () => self.completeAction('server_error'));
      }
    }
  }

  /**
   * Run an action.
   */
  runAction() {
    this.preProcessAction(error => {
      // validate the request params with the action requirements
      this.validateParams();

      if (error) {
        this.completeAction(error);
      } else if (this.validatorErrors.size > 0) {
        this.completeAction('validator_errors');
      } else if (this.toProcess === true && !error) {
        // execute the action logic
        const returnVal = this.actionTemplate.run(this.api, this, error => {
          if (error) {
            this.completeAction(error);
          } else {
            this.postProcessAction(error => this.completeAction(error));
          }
        });

        // if the returnVal is a Promise we wait for the resolve/rejection and
        // after that we finish the action execution
        if (returnVal instanceof Promise) {
          returnVal.catch(error => {
            this.completeAction(error);
          }).then(_ => {
            this.postProcessAction(error => this.completeAction(error));
          });
        }
      } else {
        this.completeAction();
      }
    });
  }
}

/**
 * Action processor Satellite.
 */
exports.default = class {
  constructor() {
    this.loadPriority = 430;
  }

  /**
   * Initializer load priority.
   *
   * @type {number}
   */


  /**
   * Satellite loading function.
   *
   * @param api   API reference object.
   * @param next  Callback function.
   */
  load(api, next) {
    // load action processor to the API
    api.actionProcessor = ActionProcessor;

    // finish the load
    next();
  }

};