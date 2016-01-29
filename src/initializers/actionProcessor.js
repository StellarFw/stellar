/**
 * This class process an action request.
 */
class ActionProcessor {

  /**
   * API reference.
   */
  api = null;

  connection = null;
  action = null;
  toProcess = true;
  toRender = true;
  messageCount = null;
  params = null;
  callback = null;
  missingParams = [];
  validatorErrors = [];
  actionStartTime = null;
  actionTemplate = null;
  working = false;
  response = {};
  duration = null;
  actionStatus = null;
  actionDomain = null;

  /**
   * Create a new Action Processor instance.
   * @param api
   */
  constructor(api, connection, callback) {
    this.api = api;
    this.connection = connection;
    this.messageCount = connection.messageCount;
    this.params = connection.params;
    this.callback = callback;
  }

  incrementTotalActions(count = 1) {
    this.connection.totalActions += count;
  }

  incrementPendingActions(count = 1) {
    this.connection.pendingActions += count;
  }

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

    if (self.actionDomain) {
      self.actionDomain.exit();
    }

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

  preProcessAction(callback) {
    console.log("todo - ActionProcessor::preProcessAction");
  }

  postProcessAction(callback) {
    console.log("todo - ActionProcessor::postProcessAction");
  }

  reduceParams() {
    console.log("todo - ActionProcessor::reduceParams");
  }

  validateParams() {
    console.log("todo - ActionProcessor::validateParams");
  }

  processAction() {
    let self = this;

    // initialize the processing environment
    self.actionStartTime = new Date().getTime();
    self.working = true;
    self.incrementTotalActions();
    self.incrementPendingActions();
    self.action = self.params.action;

    if (self.api.actions.versions[ self.action ]) {
      if (!self.params.apiVersion) {
        self.params.apiVersion = self.api.actions.versions[ self.action ][ self.api.actions.version[ self.action ].length - 1 ];
      }
      self.actionTemplate = self.api.actions.actions[ self.action ][ self.params.apiVersion ];
    }

    if (self.api.running !== true) {
      self.completeAction('server_shutting_down');
    } else if (self.getPendingActionCount(self.connection) > self.api.config.general.simultaneousActions) {
      self.completeAction('too_many_requests');
    } else if (self.actionTemplate.blockedConnectionTypes && self.actionTemplate.blockedConnectionTypes.indexOf(self.connection.type) >= 0) {
      self.completeAction('unsupported_server_type');
    } else {

      if (self.api.config.general.actionDomains === true) {
        self.actionDomain = domain.create();
        self.actionDomain.on('error', function (err) {
          self.api.exceptionHandlers.action(self.actionDomain, err, self, function () {
            self.completeAction('server_error');
          });
        });

        self.actionDomain.run(function () {
          self.runAction();
        });
      } else {
        self.runAction();
      }
    }
  }

  runAction() {
    console.log("todo - ActionProcessor::runAction");
  }

}

export default class {

  /**
   * Initializer load priority.
   *
   * @type {number}
   */
  static loadPriority = 21;

  static load(api, next) {
    // load action processor to the API
    api.actionProcessor = ActionProcessor;

    next();
  }

}
