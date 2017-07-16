'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _nodeResque = require('node-resque');

var _nodeResque2 = _interopRequireDefault(_nodeResque);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Node-Resque manager.
 */
class ResqueManager {

  /**
   * Create a new instance of ResqueManager class.
   *
   * @param api API reference object.
   */


  /**
   * Node-resque scheduler instance.
   *
   * @type {null}
   */


  /**
   * Node-resque instance.
   *
   * @type {null}
   */
  constructor(api) {
    this.api = null;
    this.queue = null;
    this.multiWorker = null;
    this.scheduler = null;
    this.connectionDetails = null;

    let self = this;

    // save the API object reference
    self.api = api;

    // define the connection details, we can use the redis property from the tasks
    self.connectionDetails = { redis: api.redis.clients.tasks };
  }

  /**
   * Start queue.
   *
   * @param callback Callback function.
   */


  /**
   * Object with the connection details.
   *
   * @type {null}
   */


  /**
   * Node-resque multi worker instance.
   *
   * @type {null}
   */

  /**
   * API reference object.
   *
   * @type {null}
   */
  startQueue(callback) {
    // we do this because the lint error
    let Queue = _nodeResque2.default.queue;

    this.queue = new Queue({ connection: this.connectionDetails }, this.api.tasks.jobs);
    this.queue.on('error', error => {
      this.api.log(error, 'error', '[api.resque.scheduler]');
    });
    this.queue.connect(callback);
  }

  /**
   * Start the scheduler system.
   *
   * @param callback  Callback function.
   */
  startScheduler(callback) {
    let self = this;

    // check if the scheduler are enabled
    if (self.api.config.tasks.scheduler !== true) {
      return callback();
    }

    // get the scheduler logger
    self.schedulerLogging = self.api.config.tasks.schedulerLogging;

    // create a new scheduler instance
    let Scheduler = _nodeResque2.default.scheduler;
    self.scheduler = new Scheduler({ connection: self.connectionDetails, timeout: self.api.config.tasks.timeout });

    // define the handler for the on error event
    self.scheduler.on('error', error => self.api.log(error, 'error', '[api.resque.scheduler]')

    // start the scheduler
    );self.scheduler.connect(() => {
      // define some handlers to the scheduler events
      self.scheduler.on('start', () => self.api.log('resque scheduler started', self.schedulerLogging.start));
      self.scheduler.on('end', () => self.api.log('resque scheduler ended', self.schedulerLogging.end));
      self.scheduler.on('poll', () => self.api.log('resque scheduler polling', self.schedulerLogging.poll));
      self.scheduler.on('working_timestamp', timestamp => self.api.log(`resque scheduler working timestamp ${timestamp}`, self.schedulerLogging.working_timestamp));
      self.scheduler.on('transferred_job', (timestamp, job) => self.api.log(`resque scheduler enqueuing job ${timestamp}`, self.schedulerLogging.transferred_job, job)

      // start the scheduler
      );self.scheduler.start

      // execute the callback function
      ();callback();
    });
  }

  /**
   * Stop scheduler.
   *
   * @param callback Callback function.
   */
  stopScheduler(callback) {
    let self = this;

    // if the scheduler not exists execute the callback function and return
    if (!self.scheduler) {
      callback();
      return;
    }

    // finish the scheduler execution
    self.scheduler.end(() => {
      self.scheduler = null;
      callback();
    });
  }

  /**
   * Start multiworker system.
   *
   * @param callback
   */
  startMultiWorker(callback) {
    let self = this;

    self.workerLogging = self.api.config.tasks.workerLogging;
    self.schedulerLogging = self.api.config.tasks.schedulerLogging;

    // create a new multiworker instance
    let MultiWorker = _nodeResque2.default.multiWorker;
    self.multiWorker = new MultiWorker({
      connection: self.connectionDetails,
      queues: self.api.config.tasks.queues,
      timeout: self.api.config.tasks.timeout,
      checkTimeout: self.api.config.tasks.checkTimeout,
      minTaskProcessors: self.api.config.tasks.minTaskProcessors,
      maxTaskProcessors: self.api.config.tasks.maxTaskProcessors,
      maxEventLoopDelay: self.api.config.tasks.maxEventLoopDelay,
      toDisconnectProcessors: self.api.config.tasks.toDisconnectProcessors
    }, self.api.tasks.jobs);

    // normal worker emitters
    self.multiWorker.on('start', workerId => self.api.log('worker: started', self.workerLogging.start, { workerId: workerId }));
    self.multiWorker.on('end', workerId => self.api.log('worker: ended', self.workerLogging.end, { workerId: workerId }));
    self.multiWorker.on('cleaning_worker', (workerId, worker, pid) => self.api.log(`worker: cleaning old worker ${worker}, (${pid})`, self.workerLogging.cleaning_worker)
    // for debug: self.multiWorker.on('poll', (queue) => self.api.log(`worker: polling ${queue}`, self.workerLogging.poll))
    );self.multiWorker.on('job', (workerId, queue, job) => self.api.log(`worker: working job ${queue}`, self.workerLogging.job, {
      workerId: workerId,
      job: { class: job.class, queue: job.queue }
    }));
    self.multiWorker.on('reEnqueue', (workerId, queue, job, plugin) => self.api.log('worker: reEnqueue job', self.workerLogging.reEnqueue, {
      workerId: workerId,
      plugin: plugin,
      job: { class: job.class, queue: job.queue }
    }));
    self.multiWorker.on('success', (workerId, queue, job, result) => self.api.log(`worker: job success ${queue}`, self.workerLogging.success, {
      workerId: workerId,
      job: { class: job.class, queue: job.queue },
      result: result
    }));
    self.multiWorker.on('pause', workerId => self.api.log('worker: paused', self.workerLogging.pause, { workerId: workerId }));

    self.multiWorker.on('failure', (workerId, queue, job, failure) => self.api.exceptionHandlers.task(failure, queue, job));
    self.multiWorker.on('error', (workerId, queue, job, error) => self.api.exceptionHandlers.task(error, queue, job)

    // multiWorker emitters
    );self.multiWorker.on('internalError', error => self.api.log(error, self.workerLogging.internalError)
    // for debug: self.multiWorker.on('multiWorkerAction', (verb, delay) => self.api.log(`*** checked for worker status: ${verb} (event loop delay: ${delay}ms)`, self.workerLogging.multiWorkerAction))

    );if (self.api.config.tasks.minTaskProcessors > 0) {
      self.multiWorker.start(() => {
        if (typeof callback === 'function') {
          callback();
        }
      });
    } else {
      if (typeof callback === 'function') {
        callback();
      }
    }
  }

  /**
   * Stop multiworker system.
   *
   * @param callback Callback function.
   */
  stopMultiWorker(callback) {
    let self = this;

    if (self.api.config.tasks.minTaskProcessors > 0) {
      self.multiWorker.stop(() => {
        self.api.log('task workers stopped');
        callback();
      });
    } else {
      callback();
    }
  }
}

/**
 * Satellite to start the resque manager.
 */
exports.default = class {
  constructor() {
    this.loadPriority = 600;
    this.startPriority = 200;
    this.stopPriority = 100;
  }
  /**
   * Satellite load priority.
   *
   * @type {number}
   */


  /**
   * Satellite start priority.
   *
   * @type {number}
   */


  /**
   * Satellite stop priority.
   *
   * @type {number}
   */


  /**
   * Satellite load methods.
   *
   * @param api   API reference object.
   * @param next  Callback function.
   */
  load(api, next) {
    // put resque manager available to the entire platform
    api.resque = new ResqueManager(api);

    // finish the satellite load execution
    next();
  }

  /**
   * Satellite start function.
   *
   * @param api   API reference object.
   * @param next  Callback function.
   */
  start(api, next) {
    if (api.config.tasks.minTaskProcessors === 0 && api.config.tasks.maxTaskProcessors > 0) {
      api.config.tasks.minTaskProcessors = 1;
    }

    // start the queue, scheduler and multiworker systems
    api.resque.startQueue(() => {
      api.resque.startScheduler(() => {
        api.resque.startMultiWorker(() => {
          next();
        });
      });
    });
  }

  /**
   * Satellite stop function.
   *
   * @param api   API reference object.
   * @param next  Callback function.
   */
  stop(api, next) {
    api.resque.stopScheduler(() => {
      api.resque.stopMultiWorker(() => {
        api.resque.queue.end(() => {
          next();
        });
      });
    });
  }
};