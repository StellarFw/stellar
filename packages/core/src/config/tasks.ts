import { LogLevel } from "@stellarfw/common/lib/index.js";

/**
 * Default task configs.
 */
export default {
  tasks(api) {
    return {
      // ---------------------------------------------------------------------
      // should this mode run a scheduler to promote delayed tasks?
      // ---------------------------------------------------------------------
      scheduler: false,

      // ---------------------------------------------------------------------
      // what queues should the taskProcessors work?
      // ---------------------------------------------------------------------
      queues: ["*"],

      // ---------------------------------------------------------------------
      // logging levels of tasks workers
      // ---------------------------------------------------------------------
      workerLogging: {
        failure: LogLevel.Error, // task failure
        success: LogLevel.Info, // task success
        start: LogLevel.Info,
        end: LogLevel.Info,
        cleaning_worker: LogLevel.Info,
        poll: LogLevel.Debug,
        job: LogLevel.Debug,
        pause: LogLevel.Debug,
        internalError: LogLevel.Error,
        multiWorkerAction: LogLevel.Debug,
      },

      // ---------------------------------------------------------------------
      // logging levels of the task scheduler
      // ---------------------------------------------------------------------
      schedulerLogging: {
        start: LogLevel.Info,
        end: LogLevel.Info,
        poll: LogLevel.Debug,
        enqueue: LogLevel.Debug,
        reEnqueue: LogLevel.Debug,
        working_timestamp: LogLevel.Debug,
        transferred_job: LogLevel.Debug,
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
      redis: api.config.redis,
    };
  },
};

/**
 * Tasks configs for test environment.
 */
export const test = {
  tasks(api) {
    return {
      timeout: 100,
      checkTimeout: 50,
      scheduler: true,
      redis: api.configs.redis,
    };
  },
};
