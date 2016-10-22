'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _os = require('os');

var _os2 = _interopRequireDefault(_os);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class ExceptionsManager {

  /**
   * API reference.
   *
   * @type {null}
   */
  constructor(api) {
    this.api = null;
    this.reporters = [];

    this.api = api;

    // load default console handler
    this.reporters.push((err, type, name, objects, severity) => {
      let lines = [];
      let extraMessages = [];

      if (type === 'loader') {
        extraMessages.push(`! Failed to load ${ objects.fullFilePath }`);
      } else if (type === 'action') {
        extraMessages.push(`! uncaught error from action: ${ name }`);

        extraMessages.push('! connection details:');
        var relevantDetails = ['action', 'remoteIP', 'type', 'params', 'room'];
        for (let i in relevantDetails) {
          if (objects.connection[relevantDetails[i]] !== null && objects.connection[relevantDetails[i]] !== undefined && typeof objects.connection[relevantDetails[i]] !== 'function') {
            extraMessages.push('!     ' + relevantDetails[i] + ': ' + JSON.stringify(objects.connection[relevantDetails[i]]));
          }
        }
      } else if (type === 'task') {
        extraMessages.push(`! uncaught error from task: ${ name } on queue ${ objects.queue } (worker #${ objects.workerId })`);
        try {
          extraMessages.push('!     arguments: ' + JSON.stringify(objects.task.args));
        } catch (e) {}
      } else {
        extraMessages.push(`! Error: ${ err.message }`);
        extraMessages.push(`!     Type: ${ type }`);
        extraMessages.push(`!     Name: ${ name }`);
        extraMessages.push('!     Data: ' + JSON.stringify(objects));
      }

      // print out the extra messages with the right severity
      for (let m in extraMessages) {
        api.log(extraMessages[m], severity);
      }

      // if there is one of the known core exceptions we need to add information
      // manually to inform the correct error information
      if (err.name) {
        lines.push(`${ err.name }: ${ err.message }`);
      }

      // add the stack trace
      try {
        lines = lines.concat(err.stack.split(_os2.default.EOL));
      } catch (e) {
        lines = lines.concat(new Error(err).stack.split(_os2.default.EOL));
      }

      for (let l in lines) {
        let line = lines[l];
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
  report(err, type, name, objects, severity = 'error') {
    let self = this;

    for (let i in self.reporters) {
      self.reporters[i](err, type, name, objects, severity);
    }
  }

  /**
   * Loader exception.
   *
   * @param fullFilePath
   * @param err
   */
  loader(fullFilePath, err) {
    let self = this;
    let name = `loader ${ fullFilePath }`;
    self.report(err, 'loader', name, { fullFilePath: fullFilePath }, 'alert');
  }

  /**
   * Handler for action exceptions.
   *
   * @param err
   * @param data
   * @param next
   */
  action(err, data, next) {
    let self = this;
    let simpleName;

    // try get the action name. Sometimes this can be impossible so we use the
    // error message instead.
    try {
      simpleName = data.action;
    } catch (e) {
      simpleName = err.message;
    }

    // report the error
    self.report(err, 'action', simpleName, { connection: data.connection }, 'error');

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
  task(error, queue, task, workerId) {
    let self = this;

    let simpleName;

    try {
      simpleName = task['class'];
    } catch (e) {
      simpleName = error.message;
    }

    self.api.exceptionHandlers.report(error, 'task', `task:${ simpleName }`, simpleName, {
      task: task,
      queue: queue,
      workerId: workerId
    }, self.api.config.tasks.workerLogging.failure);
  }
}

/**
 * Satellite definition.
 */
exports.default = class {
  constructor() {
    this.loadPriority = 130;
  }

  /**
   * Satellite load priority.
   *
   * @type {number}
   */


  /**
   * Satellite load function.
   *
   * @param api     API reference
   * @param next    Callback function
   */
  load(api, next) {
    // put the exception handlers available in all platform
    api.exceptionHandlers = new ExceptionsManager(api);

    // finish the satellite load
    next();
  }

};