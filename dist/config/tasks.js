'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
/**
 * Default task configs.
 */
exports.default = {
  tasks(api) {
    return {
      // ---------------------------------------------------------------------
      // should this mode run a scheduler to promote delayed tasks?
      // ---------------------------------------------------------------------
      scheduler: false,

      // ---------------------------------------------------------------------
      // what queues should the taskProcessors work?
      // ---------------------------------------------------------------------
      queues: ['*'],

      // ---------------------------------------------------------------------
      // logging levels of tasks workers
      // ---------------------------------------------------------------------
      workerLogging: {
        failure: 'error', // task failure
        success: 'info', // task success
        start: 'info',
        end: 'info',
        cleaning_worker: 'info',
        poll: 'debug',
        job: 'debug',
        pause: 'debug',
        internalError: 'error',
        multiWorkerAction: 'debug'
      },

      // ---------------------------------------------------------------------
      // logging levels of the task scheduler
      // ---------------------------------------------------------------------
      schedulerLogging: {
        start: 'info',
        end: 'info',
        poll: 'debug',
        enqueue: 'debug',
        reEnqueue: 'debug',
        working_timestamp: 'debug',
        transferred_job: 'debug'
      },

      // ---------------------------------------------------------------------
      // how long to sleep between jobs / scheduler checks
      // ---------------------------------------------------------------------
      timeout: 5000,

      // ---------------------------------------------------------------------
      // at minimum, how many parallel taskProcessors should this node spawn?
      // (have number > 0 to enable, and < 1 to disable)
      // ---------------------------------------------------------------------
      minTaskProcessors: 0,

      // ---------------------------------------------------------------------
      // at maximum, how many parallel taskProcessors should this node spawn?
      // ---------------------------------------------------------------------
      maxTaskProcessors: 0,

      // ---------------------------------------------------------------------
      // how often should we check the event loop to spawn more taskProcessors?
      // ---------------------------------------------------------------------
      checkTimeout: 500,

      // ---------------------------------------------------------------------
      // how many ms would constitute an event loop delay to halt
      // taskProcessors spawning?
      // ---------------------------------------------------------------------
      maxEventLoopDelay: 5,

      // ---------------------------------------------------------------------
      // When we kill off a taskProcessor, should we disconnect that local
      // redis connection?
      // ---------------------------------------------------------------------
      toDisconnectProcessors: true,

      // ---------------------------------------------------------------------
      // What redis server should we connect to for tasks / delayed jobs?
      // ---------------------------------------------------------------------
      redis: api.config.redis
    };
  }
};

/**
 * Tasks configs for test environment.
 *
 * @type {{tasks: (function())}}
 */

let test = exports.test = {
  tasks(api) {
    return {
      timeout: 100,
      checkTimeout: 50,
      scheduler: true,
      redis: api.config.redis
    };
  }
};