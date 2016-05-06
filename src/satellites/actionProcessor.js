import async from 'async';

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
   * Array with the implicit validators.
   *
   * @type {string[]}
   */
  static implicitValidators = [
    'required_if',
    'required',
    'required_unless',
    'filled',
    'required_with',
    'required_with_all',
    'required_without',
    'required_without_all'
  ]

  /**
   * Create a new Action Processor instance.
   *
   * @param api API reference.
   * @param connection Connection object.
   * @param callback Callback function.
   */
  constructor(api, connection, callback) {
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
  incrementTotalActions(count = 1) { this.connection.totalActions += count }

  /**
   * Increment the pending actions for this connection.
   *
   * @param count
   */
  incrementPendingActions(count = 1) { this.connection.pendingActions += count }

  /**
   * Get the number of pending action for this connection.
   *
   * @returns {number|*}
   */
  getPendingActionCount() { return this.connection.pendingActions }

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

  /**
   * Operations to be performed before the real action execution.
   *
   * @param callback
   */
  preProcessAction(callback) {
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
  postProcessAction(callback) {
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
  validateParams() {
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
          validatorResponse = props.validator(self.params[ key ])
        } else if (typeof props.validator === 'string') {
          // the validator property can have many validators separated by '|'
          let validators = props.validator.split('|')

          // iterate all validators and execute them
          for (let index in validators) {
            // split by ':' to get the validator arguments
            let validatorParts = validators[ index ].split(':')

            // if the property has undefined only implicit validators can be applied
            if (self.params[ key ] === undefined && ActionProcessor.implicitValidators.indexOf(validatorParts[ 0 ]) === -1) {
              continue;
            }

            // call the validator
            validatorResponse = self.execValidator(validatorParts[ 0 ], validatorParts[ 1 ], self.params[ key ], key)

            // if the response is a string that means we found a invalid validator
            if (typeof validatorResponse === 'string') { break }

            // if the validator fails return a fail message
            if (validatorResponse === false) {
              validatorResponse = `Don't match with the validator.`
              break
            }
          }
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
  runAction() {
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

  // ------------------------------------------------------------------------------------------------------ [Validators]

  /**
   * Check if the value is a string only with alpha characters.
   *
   * @param value
   * @returns {boolean}
   */
  validator_alpha(value) { return /^[a-zA-Z]*$/.test(value) }

  /**
   * Check if the value is a number.
   *
   * @param value
   * @returns {boolean}
   */
  validator_alpha_num(value) { return /^[a-zA-Z0-9]*$/.test(value) }

  /**
   * Check if the value is a string only with alpha or (_, -) characters.
   *
   * @param value
   * @returns {boolean}
   */
  validator_alpha_dash(value) { return /^[a-zA-Z0-9-_]*$/.test(value) }

  /**
   * Check if the value is an array.
   *
   * @param value
   * @returns {boolean}
   */
  validator_array(value) { return Array.isArray(value) }

  /**
   * Check if the value is before than the specified date.
   *
   * @param value
   * @param args
   * @returns {*}
   */
  validator_before(value, args) {
    // check if the developer specify an argument
    if (args === undefined) { return 'you need to specify an argument' }

    // check if the argument is a date
    if (isNaN(Date.parse(args))) { return 'the specified argument is not a valid date' }

    // check if the value if a date
    if (isNaN(Date.parse(value))) { return 'the specified value is not a valid date' }

    // check if the specified date is less than the required date
    return Date.parse(value) < Date.parse(args)
  }

  /**
   * Check if the value is between the two intervals.
   *
   * @param value
   * @param args
   * @returns {*}
   */
  validator_between(value, args) {
    // check if the developer specify the valid number of arguments
    if (!Array.isArray(args) || args.length !== 2) { return 'invalid validator arguments' }

    // check if the value is valid
    if (typeof value === 'string') {
      return value.length >= args[ 0 ] && value.length <= args[ 1 ]
    } else if (typeof value === 'number') {
      return value >= args[ 0 ] && value <= args[ 1 ]
    } else {
      return 'invalid data type'
    }
  }

  /**
   * Check if the value is a boolean.
   *
   * @param value
   * @param args
   * @returns {boolean}
   */
  validator_boolean(value) { return typeof value === 'boolean' }

  /**
   * Check if exists a confirmation fields to the testing key with the same name.
   *
   * @param value
   * @param args
   * @param key
   * @returns {*}
   */
  validator_confirmed(value, args, key) {
    // build the confirmation field name
    let confirmationFieldName = `${key}_confirmation`

    // check if the confirmation field are not present
    if (this.params[ confirmationFieldName ] === undefined) { return 'the confirmation field are not present' }

    // check if the values of two fields match
    if (this.params[ confirmationFieldName ] !== value) { return 'the values not match' }

    return true
  }

  /**
   * Check if the param is a date.
   *
   * @param value
   * @returns {*}
   */
  validator_date(value) {
    if (isNaN(Date.parse(value))) { return 'the specified value is not a valid date' }
    return true
  }

  /**
   * Check if the value is different of the other field.
   *
   * @param value
   * @param args
   * @returns {*}
   */
  validator_different(value, args) {
    // check if the validator has the correct parameter number
    if (args === undefined) { return 'the validator need one argument' }

    return value === this.params[ args ]
  }

  /**
   * Check if the value is an email.
   *
   * @param value
   * @returns {boolean}
   */
  validator_email(value) {
    return /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(value)
  }

  /**
   * Check if the value is filled.
   *
   * @param value
   * @returns {boolean}
   */
  validator_filled(value) { return value !== undefined && value !== null && value !== '' }

  /**
   * Check if the value are included in the array.
   *
   * @param value
   * @param args
   * @returns {*}
   */
  validator_in(value, args) {
    // check if the validator have a name
    if (args === undefined && !Array.isArray(args)) { return 'validator needs an array' }

    // check if the array contains the value
    return args.indexOf(String(value)) > -1
  }

  /**
   * Check if the value are not included in the array.
   * @param value
   * @param args
   * @returns {*}
   */
  validator_not_in(value, args) {
    let result = this.validator_in(value, args)
    return (result instanceof String) ? result : !result
  }

  /**
   * Check if the value is an integer.
   *
   * @param value
   * @returns {boolean}
   */
  validator_integer(value) { return Number.isInteger(value) }

  /**
   * Check if the value is an IP.
   *
   * @param value
   * @returns {boolean}
   */
  validator_ip(value) { return /^(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|$)){4}$/.test(value) }

  /**
   * Check if the field is a valid JSON.
   *
   * @param value
   * @returns {boolean}
   */
  validator_json(value) {
    try {
      let o = JSON.parse(value)

      if (o && typeof o === "object" && o !== null) { return true }
    } catch (e) {}

    return false
  }

  /**
   * Check if the parameter match with a max value.
   *
   * @param value
   * @param args
   * @returns {*}
   */
  validator_max(value, args) {
    // the validator needs one argument
    if (args === undefined) { return 'validator need at least one argument' }

    if (typeof value === 'string' || value instanceof Array) {
      return value.length <= args[ 0 ]
    } else if (typeof value === 'number') {
      return value <= args[ 0 ]
    } else {
      return 'invalid type'
    }
  }

  /**
   * Check if the parameter match with a min value.
   *
   * @param value
   * @param args
   * @returns {*}
   */
  validator_min(value, args) {
    // the validator needs one argument
    if (args === undefined) { return 'validator need at least one argument' }

    if (typeof value === 'string' || value instanceof Array) {
      return value.length >= args[ 0 ]
    } else if (typeof value === 'number') {
      return value >= args[ 0 ]
    } else {
      return 'invalid type'
    }
  }

  /**
   * Check if the value exists.
   *
   * @param value
   * @returns {boolean}
   */
  validator_required(value) { return value !== undefined }

  /**
   * Check if the value is numeric.
   *
   * @param value
   * @returns {boolean}
   */
  validator_numeric(value) { return typeof value === 'number' }

  /**
   * Check if the field is required taking into account the parameters.
   *
   * @param value
   * @param args
   * @returns {*}
   */
  validator_required_if(value, args) {
    // check if we have the needs arguments
    if (!(args instanceof Array) || args.length < 2) { return 'validator need two arguments' }

    // get the parameter to test
    let parameterToCheck = args.shift()

    // if the args[0] param value is present in the values array the value is required
    if (args.indexOf(String(this.params[ parameterToCheck ])) > -1) { return this.validator_required(value, args, attr) }

    return true
  }

  /**
   * The field under validation must be present unless the args[0] is equal to any value.
   *
   * @param value
   * @param args
   * @param attr
   * @returns {*}
   */
  validator_required_unless(value, args, attr) {
    // check if we have the needs arguments
    if (!(args instanceof Array) || args.length < 2) { return 'validator need two arguments' }

    // get the parameter to test
    let parameterToCheck = args.shift()

    // if the parameter not have a valid value the current parameter is required
    if (args.indexOf(String(this.params[ parameterToCheck ])) === -1) { return this.validator_required(value, args, attr) }

    return true
  }

  /**
   * The field under validation must be present only if any of the other specified fields are present.
   *
   * @param value
   * @param args
   * @param attr
   * @returns {*}
   */
  validator_required_with(value, args, attr) {
    // check if we have the needs arguments
    if (!(args instanceof Array) || args.length < 2) { return 'validator need two arguments' }

    // check if one of the parameters are present
    for (let index in args) {
      // get parameter name
      let paramName = args[ index ];

      //
      if (this.params[ paramName ] !== undefined) {
        return this.validator_required(value, args, attr)
      }
    }

    return true
  }

  /**
   * The field under validation must be present only if all of the other specified fields are present.
   *
   * @param value
   * @param args
   * @param attr
   * @returns {*}
   */
  validator_required_with_all(value, args, attr) {
    // check if we have the needs arguments
    if (!(args instanceof Array) || args.length < 2) { return 'validator need two arguments' }

    // check if all the parameters are present
    for (let index in args) {
      // get parameter name
      let paramName = args[ index ]

      if (this.params[ paramName ] === undefined) { return true }
    }

    // if all the fields are present the fields under validation is required
    return this.validator_required(value, args, attr)
  }

  /**
   * The field under validation must be present only when any of the other specified fields are not present.
   *
   * @param value
   * @param args
   * @param attr
   * @returns {*}
   */
  validator_required_without(value, args, attr) {
    // check if we have the needs arguments
    if (!(args instanceof Array) || args.length < 2) { return 'validator need two arguments' }

    // if one of the fields are not present the field under validation is required
    for (let index in args) {
      // get parameter name
      let paramName = args[ index ]

      if (this.params[ paramName ] === undefined) { return this.validator_required(value, args, attr) }
    }

    return true
  }

  /**
   * The field under validation must be present only when all of the other specified fields are not present.
   *
   * @param value
   * @param args
   * @param attr
   * @returns {*}
   */
  validator_required_without_all(value, args, attr) {
    // check if we have the needs arguments
    if (!(args instanceof Array) || args.length < 2) { return 'validator need two arguments' }

    for (let index in args) {
      // get parameter name
      let paramName = args[ index ]

      // if one of the fields are not present we can stop right here
      if (this.params[ paramName ] !== undefined) { return true }
    }

    return this.validator_required(value, args, attr)
  }

  /**
   * The given field must match the field under validation.
   *
   * @param value
   * @param args
   * @returns {*}
   */
  validator_same(value, args) {
    // check if we have the needs arguments
    if (!(args instanceof Array) || args.length < 1) { return 'validator need one argument' }

    return this.params[ args[ 0 ] ] === value
  }

  /**
   * The field under validation must have a size matching the given value.
   *
   * @param value
   * @param args
   */
  validator_size(value, args) {
    // check if we have the needs arguments
    if (!(args instanceof Array) || isNaN(args[ 0 ])) { return 'validator need one numeric argument' }

    if (typeof value === 'string' || value instanceof Array) {
      return value.length == args[ 0 ]
    } else if (typeof value === 'number') {
      return value == args[ 0 ]
    } else {
      return 'invalid type'
    }
  }

  /**
   * The field under validation must be a valid URL.
   *
   * @param value
   * @returns {boolean}
   */
  validator_url(value) {
    return /^(http|ftp|https):\/\/[\w-]+(\.[\w-]*)+([\w.,@?^=%&amp;:/~+#-]*[\w@?^=%&amp;/~+#-])?$/.test(value)
  }

  /**
   * Execute the request validator and apply it to the passed value.
   *
   * @param validator   Validator name.
   * @param args        Validator arguments.
   * @param value       Value to be validated.
   * @param key         Parameter key name.
   * @returns {*}
   */
  execValidator(validator, args, value, key) {
    // call the validator function
    let funcName = `validator_${validator}`

    // check if the validator exists
    if (this[ funcName ] === undefined) { return 'invalid validator' }

    // split the arguments by ',' if exists
    if (args !== undefined) { args = args.split(',') }

    // call the validator function
    return this[ funcName ](value, args, key)
  }
}

export default class {

  /**
   * Initializer load priority.
   *
   * @type {number}
   */
  static loadPriority = 430;

  static load(api, next) {
    // load action processor to the API
    api.actionProcessor = ActionProcessor;

    next();
  }

}
