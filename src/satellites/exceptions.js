import os from 'os';

class ExceptionsManager {

  /**
   * API reference.
   *
   * @type {null}
   */
  api = null;

  /**
   * Array with the exceptions reporters.
   *
   * @type {Array}
   */
  reporters = [];

  constructor (api) {
    this.api = api;

    // load default console handler
    this.reporters.push(function (err, type, name, objects, severity) {
      let extraMessages = [];

      if (type === 'loader') {
        extraMessages.push(`! Failed to load ${objects.fullFilePath}`)
      }

      else if (type === 'action') {
        extraMessages.push(`! uncaught error from action: ${name}`);
        extraMessages.push('! connection details:');
        var relevantDetails = [ 'action', 'remoteIP', 'type', 'params', 'room' ];
        for (var i in relevantDetails) {
          if (
            objects.connection[ relevantDetails[ i ] ] !== null &&
            objects.connection[ relevantDetails[ i ] ] !== undefined &&
            typeof objects.connection[ relevantDetails[ i ] ] !== 'function'
          ) {
            extraMessages.push('!     ' + relevantDetails[ i ] + ': ' + JSON.stringify(objects.connection[ relevantDetails[ i ] ]));
          }
        }
      }

      else if (type === 'task') {
        extraMessages.push(`! uncaught error from task: ${name} on queue ${objects.queue} (worker #${objects.workerId})`);
        try {
          extraMessages.push('!     arguments: ' + JSON.stringify(objects.task.args));
        } catch (e) {
        }
      }

      else {
        extraMessages.push(`! Error: ${err.message}`);
        extraMessages.push(`!     Type: ${type}`);
        extraMessages.push(`!     Name: ${name}`);
        extraMessages.push('!     Data: ' + JSON.stringify(objects));
      }

      for (let m in extraMessages) {
        api.log(extraMessages[ m ], severity);
      }
      let lines;
      try {
        lines = err.stack.split(os.EOL);
      } catch (e) {
        lines = new Error(err).stack.split(os.EOL);
      }
      for (let l in lines) {
        var line = lines[ l ];
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
  report (err, type, name, objects, severity) {
    let self = this;

    if (!severity) {
      severity = 'error';
    }

    for (let i in self.reporters) {
      self.reporters[ i ](err, type, name, objects, severity);
    }
  }

  /**
   * Loader exception.
   *
   * @param fullFilePath
   * @param err
   */
  loader (fullFilePath, err) {
    let self = this;
    let name = `loader ${fullFilePath}`;
    self.report(err, 'loader', name, {fullFilePath: fullFilePath}, 'alert');
  }

  /**
   * Handler for action exceptions.
   *
   * @param err
   * @param data
   * @param next
   */
  action (err, data, next) {
    let self = this;
    let simpleName;

    try {
      simpleName = data.action;
    } catch (e) {
      simpleName = err.message;
    }

    let name = `action ${simpleName}`;
    self.report(err, 'action', name, {connection: data.connection}, 'error');
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
  task (error, queue, task, workerId) {
    let self = this

    let simpleName

    try {
      simpleName = task[ 'class' ]
    } catch (e) {
      simpleName = error.message
    }

    self.api.exceptionHandlers.report(error, 'task', `task:${simpleName}`, name, {
      task: task,
      queue: queue,
      workerId: workerId
    }, self.api.config.tasks.workerLogging.failure)
  }
}

export default class {

  loadPriority = 130

  load (api, next) {
    api.exceptionHandlers = new ExceptionsManager(api)
    next()
  }

}
