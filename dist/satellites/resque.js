'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _nodeResque = require('node-resque');

var _nodeResque2 = _interopRequireDefault(_nodeResque);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Node-Resque manager.
 */

var ResqueManager = function () {

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

  function ResqueManager(api) {
    _classCallCheck(this, ResqueManager);

    this.api = null;
    this.queue = null;
    this.multiWorker = null;
    this.scheduler = null;
    this.connectionDetails = null;

    var self = this;

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


  _createClass(ResqueManager, [{
    key: 'startQueue',
    value: function startQueue(callback) {
      var self = this;

      self.queue = new _nodeResque2.default.queue({ connection: self.connectionDetails }, self.api.tasks.jobs);
      self.queue.on('error', function (error) {
        self.api.log(error, 'error', '[api.resque.scheduler]');
      });
      self.queue.connect(callback);
    }

    /**
     * Start the scheduler system.
     *
     * @param callback  Callback function.
     */

  }, {
    key: 'startScheduler',
    value: function startScheduler(callback) {
      var self = this;

      if (self.api.config.tasks.scheduler !== true) {
        callback();
        return;
      }

      // get the scheduler logger
      self.schedulerLogging = self.api.config.tasks.schedulerLogging;

      // create a new scheduler instance
      self.scheduler = new _nodeResque2.default.scheduler({ connection: self.connectionDetails, timeout: self.api.config.tasks.timeout });

      // define the handler for the on error event
      self.scheduler.on('error', function (error) {
        return self.api.log(error, 'error', '[api.resque.scheduler]');
      });

      // start the scheduler
      self.scheduler.connect(function () {
        // define some handlers to the scheduler events
        self.scheduler.on('start', function () {
          return self.api.log('resque scheduler started', self.schedulerLogging.start);
        });
        self.scheduler.on('end', function () {
          return self.api.log('resque scheduler ended', self.schedulerLogging.end);
        });
        self.scheduler.on('poll', function () {
          return self.api.log('resque scheduler polling', self.schedulerLogging.poll);
        });
        self.scheduler.on('working_timestamp', function (timestamp) {
          return self.api.log('resque scheduler working timestamp ' + timestamp, self.schedulerLogging.working_timestamp);
        });
        self.scheduler.on('transferred_job', function (timestamp, job) {
          return self.api.log('resque scheduler enqueuing job ' + timestamp, self.schedulerLogging.transferred_job, job);
        });

        // start the scheduler
        self.scheduler.start();

        // execute the callback function
        callback();
      });
    }

    /**
     * Stop scheduler.
     *
     * @param callback Callback function.
     */

  }, {
    key: 'stopScheduler',
    value: function stopScheduler(callback) {
      var self = this;

      // if the scheduler not exists execute the callback function and return
      if (!self.scheduler) {
        callback();
        return;
      }

      // finish the scheduler execution
      self.scheduler.end(function () {
        self.scheduler = null;
        callback();
      });
    }

    /**
     * Start multiworker system.
     *
     * @param callback
     */

  }, {
    key: 'startMultiWorker',
    value: function startMultiWorker(callback) {
      var self = this;

      self.workerLogging = self.api.config.tasks.workerLogging;
      self.schedulerLogging = self.api.config.tasks.schedulerLogging;

      // create a new multiworker instance
      self.multiWorker = new _nodeResque2.default.multiWorker({
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
      self.multiWorker.on('start', function (workerId) {
        return self.api.log('worker: started', self.workerLogging.start, { workerId: workerId });
      });
      self.multiWorker.on('end', function (workerId) {
        return self.api.log('worker: ended', self.workerLogging.end, { workerId: workerId });
      });
      self.multiWorker.on('cleaning_worker', function (workerId, worker, pid) {
        return self.api.log('worker: cleaning old worker ' + worker + ', (' + pid + ')', self.workerLogging.cleaning_worker);
      });
      // for debug: self.multiWorker.on('poll', (queue) => self.api.log(`worker: polling ${queue}`, self.workerLogging.poll))
      self.multiWorker.on('job', function (workerId, queue, job) {
        return self.api.log('worker: working job ' + queue, self.workerLogging.job, {
          workerId: workerId,
          job: { class: job.class, queue: job.queue }
        });
      });
      self.multiWorker.on('reEnqueue', function (workerId, queue, job, plugin) {
        return self.api.log('worker: reEnqueue job', self.workerLogging.reEnqueue, {
          workerId: workerId,
          plugin: plugin,
          job: { class: job.class, queue: job.queue }
        });
      });
      self.multiWorker.on('success', function (workerId, queue, job, result) {
        return self.api.log('worker: job success ' + queue, self.workerLogging.success, {
          workerId: workerId,
          job: { class: job.class, queue: job.queue },
          result: result
        });
      });
      self.multiWorker.on('pause', function (workerId) {
        return self.api.log('worker: paused', self.workerLogging.pause, { workerId: workerId });
      });

      self.multiWorker.on('failure', function (workerId, queue, job, failure) {
        return self.api.exceptionHandlers.task(failure, queue, job);
      });
      self.multiWorker.on('error', function (workerId, queue, job, error) {
        return self.api.exceptionHandlers.task(error, queue, job);
      });

      // multiWorker emitters
      self.multiWorker.on('internalError', function (error) {
        return self.api.log(error, self.workerLogging.internalError);
      });
      // for debug: self.multiWorker.on('multiWorkerAction', (verb, delay) => self.api.log(`*** checked for worker status: ${verb} (event loop delay: ${delay}ms)`, self.workerLogging.multiWorkerAction))

      if (self.api.config.tasks.minTaskProcessors > 0) {
        self.multiWorker.start(function () {
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

  }, {
    key: 'stopMultiWorker',
    value: function stopMultiWorker(callback) {
      var self = this;

      if (self.api.config.tasks.minTaskProcessors > 0) {
        self.multiWorker.stop(function () {
          self.api.log('task workers stopped');
          callback();
        });
      } else {
        callback();
      }
    }
  }]);

  return ResqueManager;
}();

/**
 * Satellite to start the resque manager.
 */


var _class = function () {
  function _class() {
    _classCallCheck(this, _class);

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


  _createClass(_class, [{
    key: 'load',


    /**
     * Satellite load methods.
     *
     * @param api   API reference object.
     * @param next  Callback function.
     */
    value: function load(api, next) {
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

  }, {
    key: 'start',
    value: function start(api, next) {
      if (api.config.tasks.minTaskProcessors === 0 && api.config.tasks.maxTaskProcessors > 0) {
        api.config.tasks.minTaskProcessors = 1;
      }

      // start the queue, scheduler and multiworker systems
      api.resque.startQueue(function () {
        api.resque.startScheduler(function () {
          api.resque.startMultiWorker(function () {
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

  }, {
    key: 'stop',
    value: function stop(api, next) {
      api.resque.stopScheduler(function () {
        api.resque.stopMultiWorker(function () {
          api.resque.queue.end(function () {
            next();
          });
        });
      });
    }
  }]);

  return _class;
}();

exports.default = _class;
//# sourceMappingURL=resque.js.map
