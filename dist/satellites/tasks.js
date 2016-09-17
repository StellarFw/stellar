'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /*eslint handle-callback-err: 0*/

var _async = require('async');

var _async2 = _interopRequireDefault(_async);

var _utils = require('../utils');

var _utils2 = _interopRequireDefault(_utils);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var TaskSatellite = function () {

  /**
   * Create a new TaskSatellite instance and save the API object.
   *
   * @param api   API reference object.
   */


  /**
   * Map with the registered tasks.
   *
   * @type {{}}
   */
  function TaskSatellite(api) {
    _classCallCheck(this, TaskSatellite);

    this.api = null;
    this.tasks = {};
    this.jobs = {};
    this.api = api;
  }

  /**
   * Load a task file intro the task manager.
   *
   * @param fullFilePath  Full task file path.
   * @param reload        This should be true is a reload.
   */


  /**
   * Map with the jobs.
   *
   * @type {Map}
   */


  /**
   * API reference object.
   *
   * @type {null}
   */


  _createClass(TaskSatellite, [{
    key: 'loadFile',
    value: function loadFile(fullFilePath) {
      var reload = arguments.length <= 1 || arguments[1] === undefined ? false : arguments[1];

      var self = this;

      // function to be used to log the task (re)load
      var loadMessage = function loadMessage(loadedTasksName) {
        var reloadWord = reload ? '(re)' : '';
        self.api.log('task ' + reloadWord + 'loaded: ' + loadedTasksName + ', ' + fullFilePath, 'debug');
      };

      // start watch for file changes
      self.api.configs.watchFileAndAct(fullFilePath, function () {
        return self.loadFile(fullFilePath, true);
      });

      // temporary task info
      var task = null;

      try {
        // get task collection
        var collection = require(fullFilePath);

        // iterate all collections
        for (var i in collection) {
          // get task logic
          task = collection[i];

          // create a new task entry
          self.tasks[task.name] = task;

          // validate task
          if (self._validateTask(self.tasks[task.name]) === false) {
            return;
          }

          // create a job wrapper on the new task
          self.jobs[task.name] = self._jobWrapper(task.name);

          // log the load message
          loadMessage(task.name);
        }
      } catch (err) {
        self.api.log('[TaskSatellite::loadFile] ' + err);

        // handle the exception
        self.api.exceptionHandlers.loader(fullFilePath, err);

        // remove the task if that exists
        delete self.tasks[task.name];
        delete self.jobs[task.name];
      }
    }

    /**
     * Wrapper the task in a job.
     *
     * @param taskName  Task name.
     * @returns {{plugins: (Array|*), pluginsOptions: (*|Array), perform: (function())}}
     * @private
     */

  }, {
    key: '_jobWrapper',
    value: function _jobWrapper(taskName) {
      var self = this;

      // get task object
      var task = self.tasks[taskName];

      // get tasks plugins
      var plugins = task.plugins || [];

      // get plugin options
      var pluginOptions = task.pluginOptions || [];

      // check if the task uses some kind of plugins
      if (task.frequency > 0) {
        if (plugins.indexOf('jobLock') < 0) {
          plugins.push('jobLock');
        }
        if (plugins.indexOf('queueLock') < 0) {
          plugins.push('queueLock');
        }
        if (plugins.indexOf('delayQueueLock') < 0) {
          plugins.push('delayQueueLock');
        }
      }

      return {
        plugins: plugins,
        pluginsOptions: pluginOptions,
        perform: function perform() {
          // get the task arguments
          var args = Array.prototype.slice.call(arguments);

          // get the callback function
          var cb = args.pop();

          // if there is no arguments
          if (args.length === 0) {
            args.push({});
          }

          // enqueue the task again
          args.push(function (error, resp) {
            self.enqueueRecurrentJob(taskName, function () {
              cb(error, resp);
            });
          });

          // add the API object at the begin of the arguments array
          args.unshift(self.api);

          // execute the task
          self.tasks[taskName].run.apply(self, args);
        }
      };
    }

    /**
     * Validate a task.
     *
     * For the task to be valid it must contain the follow properties:
     *  - name
     *  - description
     *  - frequency
     *  - queue
     *  - run
     *
     * @param task
     * @returns {boolean}
     * @private
     */

  }, {
    key: '_validateTask',
    value: function _validateTask(task) {
      var self = this;

      // function to be executed in case of the task validation fails
      var fail = function fail(msg) {
        return self.api.log(msg + '; exiting', 'emerg');
      };

      if (typeof task.name !== 'string' || task.name.length < 1) {
        fail('a task is missing \'task.name\'');
        return false;
      } else if (typeof task.description !== 'string' || task.description.length < 1) {
        fail('Task ' + task.name + ' is missing \'task.description\'');
        return false;
      } else if (typeof task.frequency !== 'number') {
        fail('Task ' + task.name + ' has no frequency');
        return false;
      } else if (typeof task.queue !== 'string') {
        fail('Task ' + task.name + ' has no queue');
        return false;
      } else if (typeof task.run !== 'function') {
        fail('Task ' + task.name + ' has no run method');
        return false;
      }

      return true;
    }

    /**
     * Load all modules tasks.
     *
     * Iterate all active modules to load their tasks, if exists.
     */

  }, {
    key: 'loadModulesTasks',
    value: function loadModulesTasks() {
      var self = this;

      // get all active modules
      self.api.modules.modulesPaths.forEach(function (modulePath) {
        // build the task folder path for the current module
        var tasksFolder = modulePath + '/tasks';

        // load task files
        _utils2.default.recursiveDirectoryGlob(tasksFolder).forEach(function (f) {
          return self.loadFile(f);
        });
      });
    }

    // -------------------------------------------------------------------------------------------- [ways to queue a task]

    /**
     * Enqueue a new job, normally.
     *
     * @param  {String}   taskName Unique task identifier.
     * @param  {Array}    params   Parameters to be passed to the task.
     * @param  {String}   queue    Queue here the task must be enqueued.
     * @param  {Function} callback Callback function.
     */

  }, {
    key: 'enqueue',
    value: function enqueue(taskName, params, queue, callback) {
      var self = this;

      if (typeof queue === 'function' && callback === undefined) {
        callback = queue;
        queue = self.tasks[taskName].queue;
      } else if (typeof params === 'function' && callback === undefined && queue === undefined) {
        callback = params;
        queue = self.tasks[taskName].queue;
        params = {};
      }

      self.api.resque.queue.enqueue(queue, taskName, params, callback);
    }

    /**
     * Enqueue a task and execute them in a given timestamp.
     *
     * @param  {Decimal}  timestamp Timestamp when the task must be executed.
     * @param  {String}   taskName  Unique task identifier of the task to add.
     * @param  {Object}   params    Parameters to be passed to the task.
     * @param  {String}   queue     Queue where the task must be enqueued.
     * @param  {Function} callback  Callback function.
     */

  }, {
    key: 'enqueueAt',
    value: function enqueueAt(timestamp, taskName, params, queue, callback) {
      var self = this;

      if (typeof queue === 'function' && callback === undefined) {
        callback = queue;
        queue = this.tasks[taskName].queue;
      } else if (typeof params === 'function' && callback === undefined && queue === undefined) {
        callback = params;
        queue = this.tasks[taskName].queue;
        params = {};
      }
      self.api.resque.queue.enqueueAt(timestamp, queue, taskName, params, callback);
    }

    /**
     * Enqueue a tasks and execute them with a delay.
     *
     * @param  {Decimal}  time     Delay in milliseconds.
     * @param  {String}   taskName Unique identifier for the task to enqueue.
     * @param  {Object}   params   Parameters to be passed to the task.
     * @param  {String}   queue    Queue where the task will be enqueued.
     * @param  {Function} callback Callback function.
     */

  }, {
    key: 'enqueueIn',
    value: function enqueueIn(time, taskName, params, queue, callback) {
      var self = this;

      if (typeof queue === 'function' && callback === undefined) {
        callback = queue;
        queue = self.tasks[taskName].queue;
      } else if (typeof params === 'function' && callback === undefined && queue === undefined) {
        callback = params;
        queue = self.tasks[taskName].queue;
        params = {};
      }

      self.api.resque.queue.enqueueIn(time, queue, taskName, params, callback);
    }

    /**
     * Remove a task by name.
     *
     * @param  {String}   queue    Queue here the task are located.
     * @param  {String}   taskName Unique identifier of the task to be removed.
     * @param  {Object}   args     Arguments to pass to node-resque.
     * @param  {Number}   count    Number of task entries to be removed.
     * @param  {Function} callback Callback function.
     */

  }, {
    key: 'del',
    value: function del(queue, taskName, args, count, callback) {
      var self = this;
      self.api.resque.queue.del(queue, taskName, args, count, callback);
    }

    /**
     * Remove a delayed task by name.
     *
     * @param  {String}   queue    Queue where the task must be removed.
     * @param  {String}   taskName Task unique identifier.
     * @param  {Object}   args     Arguments to pass to node-resque.
     * @param  {Function} callback Callback function.
     */

  }, {
    key: 'delDelayed',
    value: function delDelayed(queue, taskName, args, callback) {
      var self = this;
      self.api.resque.queue.delDelayed(queue, taskName, args, callback);
    }

    /**
     * Get the timestamps when a task will be executed.
     *
     * @param  {String}   queue    Queue identifier.
     * @param  {String}   taskName Task unique identifier.
     * @param  {Object}   args     Arguments to pass to node-resque.
     * @param  {Function} callback Callback function.
     */

  }, {
    key: 'scheduledAt',
    value: function scheduledAt(queue, taskName, args, callback) {
      var self = this;
      self.api.resque.queue.scheduledAt(queue, taskName, args, callback);
    }
  }, {
    key: 'stats',
    value: function stats(callback) {
      this.api.resque.queue.stats(callback);
    }

    /**
     * Get works queued between the given time interval.
     *
     * @param  {String}   queue    Queue to check.
     * @param  {Decimal}  start    Start timestamp.
     * @param  {Decimal}  stop     End timestamp.
     * @param  {Function} callback Callback function.
     */

  }, {
    key: 'queued',
    value: function queued(queue, start, stop, callback) {
      this.api.resque.queue.queued(queue, start, stop, callback);
    }

    /**
     * Remove a queue.
     *
     * @param  {String}   queue    Queue to be removed.
     * @param  {Function} callback Callback function.
     */

  }, {
    key: 'delQueue',
    value: function delQueue(queue, callback) {
      this.api.resque.queue.delQueue(queue, callback);
    }

    /**
     * Get the locks.
     *
     * @param  {Function} callback Callback function.
     */

  }, {
    key: 'locks',
    value: function locks(callback) {
      var self = this;
      self.api.resque.queue.locks(callback);
    }

    /**
     * Remove a lock.
     *
     * @param  {String}   lock     Lock to be removed.
     * @param  {Function} callback Callback function.
     */

  }, {
    key: 'delLock',
    value: function delLock(lock, callback) {
      var self = this;
      self.api.resque.queue.delLock(lock, callback);
    }
  }, {
    key: 'timestamps',
    value: function timestamps(callback) {
      var self = this;
      self.api.resque.queue.timestamps(callback);
    }
  }, {
    key: 'delayedAt',
    value: function delayedAt(timestamp, callback) {
      var self = this;
      self.api.resque.queue.delayedAt(timestamp, callback);
    }
  }, {
    key: 'allDelayed',
    value: function allDelayed(callback) {
      var self = this;
      self.api.resque.queue.allDelayed(callback);
    }
  }, {
    key: 'workers',
    value: function workers(callback) {
      var self = this;
      self.api.resque.queue.workers(callback);
    }
  }, {
    key: 'workingOn',
    value: function workingOn(workerName, queues, callback) {
      var self = this;
      self.api.resque.queue.workingOn(workerName, queues, callback);
    }
  }, {
    key: 'allWorkingOn',
    value: function allWorkingOn(callback) {
      var self = this;
      self.api.resque.queue.allWorkingOn(callback);
    }
  }, {
    key: 'failedCount',
    value: function failedCount(callback) {
      var self = this;
      self.api.resque.queue.failedCount(callback);
    }
  }, {
    key: 'failed',
    value: function failed(start, stop, callback) {
      var self = this;
      self.api.resque.queue.failed(start, stop, callback);
    }
  }, {
    key: 'removeFailed',
    value: function removeFailed(failedJob, callback) {
      var self = this;
      self.api.resque.queue.removeFailed(failedJob, callback);
    }
  }, {
    key: 'retryAndRemoveFailed',
    value: function retryAndRemoveFailed(failedJob, callback) {
      var self = this;
      self.api.resque.queue.retryAndRemoveFailed(failedJob, callback);
    }
  }, {
    key: 'cleanOldWorkers',
    value: function cleanOldWorkers(age, callback) {
      var self = this;
      self.api.resque.queue.cleanOldWorkers(age, callback);
    }

    /**
     * Enqueue recurrent job.
     *
     * @param taskName Task's name.
     * @param callback Callback function.
     */

  }, {
    key: 'enqueueRecurrentJob',
    value: function enqueueRecurrentJob(taskName, callback) {
      var self = this;

      // get task object
      var task = self.tasks[taskName];

      // if it isn't a periodic task execute the callback function and return
      if (task.frequency <= 0) {
        callback();
        return;
      }

      self.del(task.queue, taskName, {}, function () {
        self.delDelayed(task.queue, taskName, {}, function () {
          self.enqueueIn(task.frequency, taskName, function () {
            self.api.log('re-enqueued recurrent job ' + taskName, self.api.config.tasks.schedulerLogging.reEnqueue);
            callback();
          });
        });
      });
    }

    /**
     * Enqueue all the recurrent jobs.
     *
     * @param callback  Callback function.
     */

  }, {
    key: 'enqueueAllRecurrentJobs',
    value: function enqueueAllRecurrentJobs(callback) {
      var self = this;
      var jobs = [];
      var loadedTasks = [];

      Object.keys(self.tasks).forEach(function (taskName) {
        // get task object
        var task = self.tasks[taskName];

        if (task.frequency > 0) {
          jobs.push(function (done) {
            self.enqueue(taskName, function (error, toRun) {
              if (error) {
                return done(error);
              }
              if (toRun === true) {
                self.api.log('enqueuing periodic task ' + taskName, self.api.config.tasks.schedulerLogging.enqueue);
                loadedTasks.push(taskName);
              }

              return done();
            });
          });
        }
      });

      _async2.default.series(jobs, function (error) {
        if (error) {
          return callback(error);
        }
        return callback(null, loadedTasks);
      });
    }

    /**
     * Remove a recurrent task from the queue.
     *
     * @param taskName  Task's name to be removed.
     * @param callback  Callback function.
     */

  }, {
    key: 'stopRecurrentJob',
    value: function stopRecurrentJob(taskName, callback) {
      var self = this;
      var task = self.tasks[taskName];

      // if isn't a recurrent task execute the callback and return
      if (task.frequency <= 0) {
        callback();
        return;
      }

      var removedCount = 0;

      // remove the task from the recurrent queue
      self.del(task.queue, task.name, {}, 1, function (error, count) {
        removedCount = removedCount + count;
        self.delDelayed(task.queue, task.name, {}, function (error, timestamps) {
          removedCount = removedCount + timestamps.length;
          callback(error, removedCount);
        });
      });
    }

    /**
     * Get the current task queue state.
     *
     * @param callback  Callback function.
     */

  }, {
    key: 'details',
    value: function details(callback) {
      var self = this;

      var result = { 'queues': {}, 'workers': {} };
      var jobs = [];

      // push all the workers to the result var
      jobs.push(function (done) {
        self.api.tasks.allWorkingOn(function (error, workers) {
          if (error) {
            return done(error);
          }
          result.workers = workers;
        });
      });

      // push all the queue to the result var
      jobs.push(function (done) {
        self.api.resque.queue.queues(function (error, queues) {
          if (error) {
            return done(error);
          }
          var queueJobs = [];

          queues.forEach(function (queue) {
            queueJobs.push(function (qDone) {
              self.resque.queue.length(queue, function (error, length) {
                if (error) {
                  return qDone(error);
                }
                result.queues[queue] = { length: length };
                return qDone();
              });
            });
          });

          _async2.default.series(queueJobs, done);
        });
      });

      _async2.default.series(jobs, callback);
    }
  }]);

  return TaskSatellite;
}();

/**
 * This loads the task features to the API object.
 */


var _class = function () {
  function _class() {
    _classCallCheck(this, _class);

    this.loadPriority = 699;
    this.startPriority = 900;
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


  _createClass(_class, [{
    key: 'load',


    /**
     * Load the logic intro the API object.
     *
     * @param api   API reference.
     * @param next  Callback function.
     */
    value: function load(api, next) {
      // load task features to the API object
      api.tasks = new TaskSatellite(api);

      // load modules tasks
      api.tasks.loadModulesTasks();

      // finish the satellite initialization
      next();
    }

    /**
     * Satellite start function.
     *
     * @param api   API object reference.
     * @param next  Callback function.
     */

  }, {
    key: 'start',
    value: function start(api, next) {
      if (api.config.tasks.scheduler === true) {
        api.tasks.enqueueAllRecurrentJobs(function (error) {
          return next(error);
        });
      } else {
        next();
      }
    }
  }]);

  return _class;
}();

exports.default = _class;