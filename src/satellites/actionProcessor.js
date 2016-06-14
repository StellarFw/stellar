import async from 'async'

/**
 * This class process an action request.
 */
class ActionProcessor {

  /**
   * API reference.
   *
   * @type {null}
   */
  api = null

  connection = null
  action = null
  toProcess = true
  toRender = true
  messageCount = null
  params = null
  callback = null
  missingParams = []
  validatorErrors = []
  actionStartTime = null
  actionTemplate = null
  working = false
  response = {}
  duration = null
  actionStatus = null

  /**
   * Create a new Action Processor instance.
   *
   * @param api API reference.
   * @param connection Connection object.
   * @param callback Callback function.
   */
  constructor (api, connection, callback) {
    this.api = api
    this.connection = connection
    this.messageCount = connection.messageCount
    this.params = connection.params
    this.callback = callback
  }

  /**
   * Increment the total number of executed actions for this connection.
   *
   * @param count
   */
  incrementTotalActions (count = 1) { this.connection.totalActions += count }

  /**
   * Increment the pending actions for this connection.
   *
   * @param count
   */
  incrementPendingActions (count = 1) { this.connection.pendingActions += count }

  /**
   * Get the number of pending action for this connection.
   *
   * @returns {number|*}
   */
  getPendingActionCount () { return this.connection.pendingActions }

  /**
   * Complete the action execution.
   *
   * This essentially logs the action execution status.
   *
   * @param status
   */
  completeAction (status) {
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
      error = self.api.config.errors.tooManyPendingActions()
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
  logAction (error) {
    let self = this;
    let logLevel = 'info';

    // check if the action have a specific log level
    if (self.actionTemplate && self.actionTemplate.logLevel) {
      logLevel = self.actionTemplate.logLevel;
    }

    let filteredParams = {};
    for (let i in self.params) {
      if (self.api.config.general.filteredParams && self.api.config.general.filteredParams.indexOf(i) >= 0) {
        filteredParams[ i ] = '[FILTERED]';
      } else if (typeof self.params[ i ] === 'string') {
        filteredParams[ i ] = self.params[ i ].substring(0, self.api.config.logger.maxLogStringLength);
      } else {
        filteredParams[ i ] = self.params[ i ]
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
    self.api.log(`[ action @  ${self.connection.type}]`, logLevel, logLine);
  }

  /**
   * Operations to be performed before the real action execution.
   *
   * @param callback
   */
  preProcessAction (callback) {
    let self = this;
    let processors = [];
    let processorsNames = self.api.actions.globalMiddleware.slice(0);

    // get action processor names
    if (self.actionTemplate.middleware) {
      self.actionTemplate.middleware.forEach(function (m) {
        processorsNames.push(m);
      });
    }

    processorsNames.forEach(function (name) {
      if (typeof self.api.actions.middleware[ name ].preProcessor === 'function') {
        processors.push(function (next) {
          self.api.actions.middleware[ name ].preProcessor(self, next);
        });
      }
    });

    async.series(processors, function (err) {
      callback(err);
    });
  }

  /**
   * Operations to be performed after the action execution.
   *
   * @param callback
   */
  postProcessAction (callback) {
    let self = this;
    let processors = [];
    let processorNames = self.api.actions.globalMiddleware.slice(0);

    if (self.actionTemplate.middleware) {
      self.actionTemplate.middleware.forEach(function (m) {
        processorNames.push(m);
      });
    }

    processorNames.forEach(function (name) {
      if (typeof api.actions.middleware[ name ].postProcessor === 'function') {
        processors.push(function (next) {
          self.api.actions.middleware[ name ].postProcessor(self, next);
        });
      }
    });

    async.series(processors, function (err) {
      callback(err);
    });
  }

  /**
   * Validate call params with the action requirements.
   */
  validateParams () {
    let self = this;

    // iterate inputs definitions of the called action
    for (let key in self.actionTemplate.inputs) {
      // get input properties
      let props = self.actionTemplate.inputs[ key ];

      // default
      if (self.params[ key ] === undefined && props.default !== undefined) {
        if (typeof props.default === 'function') {
          self.params[ key ] = props.default(self.params[ key ], self);
        } else {
          self.params[ key ] = props.default;
        }
      }

      // validator
      if (props.validator !== undefined) {
        let validatorResponse = true;

        if (typeof props.validator === 'function') {
          validatorResponse = props.validator.call(self.api, self.params[ key ], self)
        } else if (typeof props.validator === 'string') {
          validatorResponse = self.api.validator.validate(props.validator, self.params, key, self.params[ key ])
        } else {
          let pattern = new RegExp(props.validator)
          validatorResponse = pattern.test(self.params[ key ]) ? true : `Don't match with the validator.`
        }

        // if an error are present add it to the validatorErrors array
        if (validatorResponse !== true) { self.validatorErrors.push(validatorResponse) }
      }

      // required
      if (props.required === true) {
        if (self.api.config.general.missingParamChecks.indexOf(self.params[ key ]) >= 0) {
          self.missingParams.push(key);
        }
      }
    }
  }

  processAction () {
    let self = this;

    // initialize the processing environment
    self.actionStartTime = new Date().getTime();
    self.working = true;
    self.incrementTotalActions();
    self.incrementPendingActions();
    self.action = self.params.action;

    if (self.api.actions.versions[ self.action ]) {
      if (!self.params.apiVersion) {
        self.params.apiVersion = self.api.actions.versions[ self.action ][ self.api.actions.versions[ self.action ].length - 1 ];
      }
      self.actionTemplate = self.api.actions.actions[ self.action ][ self.params.apiVersion ];
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
          self.completeAction('server_error');
        });
      }
    }
  }

  /**
   * Run an action.
   */
  runAction () {
    let self = this;

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
              self.completeAction(error);
            });
          }
        });
      } else {
        self.completeAction();
      }
    });
  }
}

/**
 * Action processor Satellite.
 */
export default class {

  /**
   * Initializer load priority.
   *
   * @type {number}
   */
  loadPriority = 430

  /**
   * Satellite loading function.
   *
   * @param api   API reference object.
   * @param next  Callback function.
   */
  load (api, next) {
    // load action processor to the API
    api.actionProcessor = ActionProcessor

    // finish the load
    next()
  }

}
