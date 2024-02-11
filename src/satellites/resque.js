import NR from "node-resque";

/**
 * Node-Resque manager.
 */
class ResqueManager {
  /**
   * API reference object.
   *
   * @type {null}
   */
  api = null;

  /**
   * Node-resque instance.
   *
   * @type {null}
   */
  queue = null;

  /**
   * Node-resque multi worker instance.
   *
   * @type {null}
   */
  multiWorker = null;

  /**
   * Node-resque scheduler instance.
   *
   * @type {null}
   */
  scheduler = null;

  /**
   * Object with the connection details.
   *
   * @type {null}
   */
  connectionDetails = null;

  /**
   * Create a new instance of ResqueManager class.
   *
   * @param api API reference object.
   */
  constructor(api) {
    this.api = api;

    // define the connection details, we can use the redis property from the tasks
    this.connectionDetails = { redis: api.redis.clients.tasks };
  }

  /**
   * Start queue.
   *
   * @param callback Callback function.
   */
  startQueue(callback) {
    // we do this because the lint error
    let Queue = NR.queue;

    this.queue = new Queue({ connection: this.connectionDetails }, this.api.tasks.jobs);
    this.queue.on("error", (error) => {
      this.api.log(error, "error", "[api.resque.scheduler]");
    });
    this.queue.connect(callback);
  }

  /**
   * Start the scheduler system.
   *
   * @param callback  Callback function.
   */
  startScheduler(callback) {
    // check if the scheduler are enabled
    if (this.api.config.tasks.scheduler !== true) {
      return callback();
    }

    // get the scheduler logger
    this.schedulerLogging = this.api.config.tasks.schedulerLogging;

    // create a new scheduler instance
    let Scheduler = NR.scheduler;
    this.scheduler = new Scheduler({
      connection: this.connectionDetails,
      timeout: this.api.config.tasks.timeout,
    });

    // define the handler for the on error event
    this.scheduler.on("error", (error) => this.api.log(error, "error", "[api.resque.scheduler]"));

    // start the scheduler
    this.scheduler.connect(() => {
      // define some handlers to the scheduler events
      this.scheduler.on("start", () => this.api.log("resque scheduler started", this.schedulerLogging.start));
      this.scheduler.on("end", () => this.api.log("resque scheduler ended", this.schedulerLogging.end));
      this.scheduler.on("poll", () => this.api.log("resque scheduler polling", this.schedulerLogging.poll));
      this.scheduler.on("working_timestamp", (timestamp) =>
        this.api.log(`resque scheduler working timestamp ${timestamp}`, this.schedulerLogging.working_timestamp),
      );
      this.scheduler.on("transferred_job", (timestamp, job) =>
        this.api.log(`resque scheduler enqueuing job ${timestamp}`, this.schedulerLogging.transferred_job, job),
      );

      // start the scheduler
      this.scheduler.start();

      // execute the callback function
      callback();
    });
  }

  /**
   * Stop scheduler.
   *
   * @param callback Callback function.
   */
  stopScheduler(callback) {
    // if the scheduler not exists execute the callback function and return
    if (!this.scheduler) {
      callback();
      return;
    }

    // finish the scheduler execution
    this.scheduler.end(() => {
      this.scheduler = null;
      callback();
    });
  }

  /**
   * Start multiworker system.
   *
   * @param callback
   */
  startMultiWorker(callback) {
    this.workerLogging = this.api.config.tasks.workerLogging;
    this.schedulerLogging = this.api.config.tasks.schedulerLogging;

    // create a new multiworker instance
    let MultiWorker = NR.multiWorker;
    this.multiWorker = new MultiWorker(
      {
        connection: this.connectionDetails,
        queues: this.api.config.tasks.queues,
        timeout: this.api.config.tasks.timeout,
        checkTimeout: this.api.config.tasks.checkTimeout,
        minTaskProcessors: this.api.config.tasks.minTaskProcessors,
        maxTaskProcessors: this.api.config.tasks.maxTaskProcessors,
        maxEventLoopDelay: this.api.config.tasks.maxEventLoopDelay,
        toDisconnectProcessors: this.api.config.tasks.toDisconnectProcessors,
      },
      this.api.tasks.jobs,
    );

    // normal worker emitters
    this.multiWorker.on("start", (workerId) =>
      this.api.log("worker: started", this.workerLogging.start, {
        workerId: workerId,
      }),
    );
    this.multiWorker.on("end", (workerId) =>
      this.api.log("worker: ended", this.workerLogging.end, {
        workerId: workerId,
      }),
    );
    this.multiWorker.on("cleaning_worker", (workerId, worker, pid) =>
      this.api.log(`worker: cleaning old worker ${worker}, (${pid})`, this.workerLogging.cleaning_worker),
    );
    // for debug: this.multiWorker.on('poll', (queue) => this.api.log(`worker: polling ${queue}`, this.workerLogging.poll))
    this.multiWorker.on("job", (workerId, queue, job) =>
      this.api.log(`worker: working job ${queue}`, this.workerLogging.job, {
        workerId: workerId,
        job: { class: job.class, queue: job.queue },
      }),
    );
    this.multiWorker.on("reEnqueue", (workerId, queue, job, plugin) =>
      this.api.log("worker: reEnqueue job", this.workerLogging.reEnqueue, {
        workerId: workerId,
        plugin: plugin,
        job: { class: job.class, queue: job.queue },
      }),
    );
    this.multiWorker.on("success", (workerId, queue, job, result) =>
      this.api.log(`worker: job success ${queue}`, this.workerLogging.success, {
        workerId: workerId,
        job: { class: job.class, queue: job.queue },
        result: result,
      }),
    );
    this.multiWorker.on("pause", (workerId) =>
      this.api.log("worker: paused", this.workerLogging.pause, {
        workerId: workerId,
      }),
    );

    this.multiWorker.on("failure", (workerId, queue, job, failure) =>
      this.api.exceptionHandlers.task(failure, queue, job),
    );
    this.multiWorker.on("error", (workerId, queue, job, error) => this.api.exceptionHandlers.task(error, queue, job));

    // multiWorker emitters
    this.multiWorker.on("internalError", (error) => this.api.log(error, this.workerLogging.internalError));
    // for debug: this.multiWorker.on('multiWorkerAction', (verb, delay) => this.api.log(`*** checked for worker status: ${verb} (event loop delay: ${delay}ms)`, this.workerLogging.multiWorkerAction))

    if (this.api.config.tasks.minTaskProcessors > 0) {
      this.multiWorker.start(() => {
        if (typeof callback === "function") {
          callback();
        }
      });
    } else {
      if (typeof callback === "function") {
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
    if (this.api.config.tasks.minTaskProcessors > 0) {
      this.multiWorker.stop(() => {
        this.api.log("task workers stopped");
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
export default class {
  /**
   * Satellite load priority.
   *
   * @type {number}
   */
  loadPriority = 600;

  /**
   * Satellite start priority.
   *
   * @type {number}
   */
  startPriority = 200;

  /**
   * Satellite stop priority.
   *
   * @type {number}
   */
  stopPriority = 100;

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
}
