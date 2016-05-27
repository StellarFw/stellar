import async from 'async'
import Utils from '../utils'

class TaskSatellite {

  /**
   * API reference object.
   *
   * @type {null}
   */
  api = null

  /**
   * Map with the registered tasks.
   *
   * @type {{}}
   */
  tasks = {}

  /**
   * Map with the jobs.
   *
   * @type {Map}
   */
  jobs = {}

  /**
   * Create a new TaskSatellite instance and save the API object.
   *
   * @param api   API reference object.
   */
  constructor (api) { this.api = api }

  /**
   * Load a task file intro the task manager.
   *
   * @param fullFilePath  Full task file path.
   * @param reload        This should be true is a reload.
   */
  loadFile (fullFilePath, reload = false) {
    let self = this

    // function to be used to log the task (re)load
    let loadMessage = (loadedTasksName) => {
      let reloadWord = reload ? '(re)' : ''
      self.api.log(`task ${reloadWord}loaded: ${loadedTasksName}, ${fullFilePath}`, 'debug')
    }

    // start watch for file changes
    self.api.configs.watchFileAndAct(fullFilePath, () => self.loadFile(fullFilePath, true))

    // temporary task info
    let task = null

    try {
      // get task collection
      let collection = require(fullFilePath)

      // iterate all collections
      for (let i in collection) {
        // get task logic
        task = collection[ i ]

        // create a new task entry
        self.tasks[ task.name ] = task

        // validate task
        if (self._validateTask(self.tasks[ task.name ]) === false) { return }

        // create a job wrapper on the new task
        self.jobs[ task.name ] = self._jobWrapper(task.name)

        // log the load message
        loadMessage(task.name)
      }
    } catch (err) {
      api.log(`[TaskSatellite::loadFile] ${err}`)

      // handle the exception
      self.api.exceptionHandlers.loader(fullFilePath, err)

      // remove the task if that exists
      delete self.tasks[ task.name ]
      delete self.jobs[ task.name ]
    }
  }

  /**
   * Wrapper the task in a job.
   *
   * @param taskName  Task name.
   * @returns {{plugins: (Array|*), pluginsOptions: (*|Array), perform: (function())}}
   * @private
   */
  _jobWrapper (taskName) {
    let self = this

    // get task object
    let task = self.tasks[ taskName ]

    // get tasks plugins
    let plugins = task.plugins || []

    // get plugin options
    let pluginOptions = task.pluginOptions || []

    // check if the task uses some kind of plugins
    if (task.frequency > 0) {
      if (plugins.indexOf('jobLock') < 0) { plugins.push('jobLock') }
      if (plugins.indexOf('queueLock') < 0) { plugins.push('queueLock') }
      if (plugins.indexOf('delayQueueLock') < 0) { plugins.push('delayQueueLock') }
    }

    return {
      plugins: plugins,
      pluginsOptions: pluginOptions,
      perform: function () {
        // get the task arguments
        let args = Array.prototype.slice.call(arguments)

        // get the callback function
        let cb = args.pop()

        // if there is no arguments
        if (args.length == 0) { args.push({}) }

        // enqueue the task again
        args.push((error, resp) => {
          self.enqueueRecurrentJob(taskName, () => {
            cb(error, resp)
          })
        })

        // add the API object at the begin of the arguments array
        args.unshift(self.api)

        // execute the task
        self.tasks[ taskName ].run.apply(self, args)
      }
    }
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
  _validateTask (task) {
    let self = this

    // function to be executed in case of the task validation fails
    let fail = msg => self.api.log(`${msg}; exiting`, 'emerg')

    if (typeof task.name !== 'string' || task.name.length < 1) {
      fail(`a task is missing 'task.name'`)
      return false
    } else if (typeof task.description !== 'string' || task.description.length < 1) {
      fail(`Task ${task.name} is missing 'task.description'`)
      return false
    } else if (typeof task.frequency !== 'number') {
      fail(`Task ${task.name} has no frequency`)
      return false
    } else if (typeof task.queue !== 'string') {
      fail(`Task ${task.name} has no queue`)
      return false
    } else if (typeof task.run !== 'function') {
      fail(`Task ${task.name} has no run method`)
      return false
    }

    return true
  }

  /**
   * Load all modules tasks.
   *
   * Iterate all active modules to load their tasks, if exists.
   */
  loadModulesTasks () {
    let self = this

    // get all active modules
    self.api.config.modulesPaths.forEach(modulePath => {
      // build the task folder path for the current module
      let tasksFolder = `${modulePath}/tasks`

      // load task files
      Utils.recursiveDirectoryGlob(tasksFolder).forEach(f => self.loadFile(f))
    })
  }

  // -------------------------------------------------------------------------------------------- [ways to queue a task]

  enqueue (taskName, params, queue, callback) {
    let self = this

    if (typeof queue === 'function' && callback === undefined) {
      callback = queue
      queue = self.tasks[ taskName ].queue
    } else if (typeof params === 'function' && callback === undefined && queue === undefined) {
      callback = params
      queue = self.tasks[ taskName ].queue
      params = {}
    }

    self.api.resque.queue.enqueue(queue, taskName, params, callback)
  }

  enqueueAt (timestamp, taskName, params, queue, callback) {
    let self = this

    if (typeof queue === 'function' && callback === undefined) {
      callback = queue;
      queue = this.tasks[ taskName ].queue;
    }
    else if (typeof params === 'function' && callback === undefined && queue === undefined) {
      callback = params;
      queue = this.tasks[ taskName ].queue;
      params = {};
    }
    self.api.resque.queue.enqueueAt(timestamp, queue, taskName, params, callback);
  }

  enqueueIn (time, taskName, params, queue, callback) {
    let self = this

    if (typeof queue === 'function' && callback === undefined) {
      callback = queue;
      queue = self.tasks[ taskName ].queue;
    } else if (typeof params === 'function' && callback === undefined && queue === undefined) {
      callback = params;
      queue = self.tasks[ taskName ].queue;
      params = {};
    }

    self.api.resque.queue.enqueueIn(time, queue, taskName, params, callback);
  }

  del (q, taskName, args, count, callback) {
    let self = this
    self.api.resque.queue.del(q, taskName, args, count, callback)
  }

  delDelayed (q, taskName, args, callback) {
    let self = this
    self.api.resque.queue.delDelayed(q, taskName, args, callback)
  }

  scheduledAt (q, taskName, args, callback) {
    let self = this
    self.api.resque.queue.scheduledAt(q, taskName, args, callback)
  }

  timestamps (callback) {
    let self = this
    self.api.resque.queue.timestamps(callback)
  }

  delayedAt (timestamp, callback) {
    let self = this
    self.api.resque.queue.delayedAt(timestamp, callback)
  }

  allDelayed (callback) {
    let self = this
    self.api.resque.queue.allDelayed(callback)
  }

  workers (callback) {
    let self = this
    self.api.resque.queue.workers(callback)
  }

  workingOn (workerName, queues, callback) {
    let self = this
    self.api.resque.queue.workingOn(workerName, queues, callback)
  }

  allWorkingOn (callback) {
    let self = this
    self.api.resque.queue.allWorkingOn(callback)
  }

  failedCount (callback) {
    let self = this
    self.api.resque.queue.failedCount(callback)
  }

  failed (start, stop, callback) {
    let self = this
    self.api.resque.queue.failed(start, stop, callback)
  }

  removeFailed (failedJob, callback) {
    let self = this
    self.api.resque.queue.removeFailed(failedJob, callback)
  }

  retryAndRemoveFailed (failedJob, callback) {
    let self = this
    self.api.resque.queue.retryAndRemoveFailed(failedJob, callback)
  }

  cleanOldWorkers (age, callback) {
    let self = this
    self.api.resque.queue.cleanOldWorkers(age, callback)
  }

  /**
   * Enqueue recurrent job.
   *
   * @param taskName Task's name.
   * @param callback Callback function.
   */
  enqueueRecurrentJob (taskName, callback) {
    let self = this

    // get task object
    let task = self.tasks[ taskName ]

    // if it isn't a periodic task execute the callback function and return
    if (task.frequency <= 0) {
      callback()
      return
    }

    self.del(task.queue, taskName, {}, () => {
      self.delDelayed(task.queue, taskName, {}, () => {
        self.enqueueIn(task.frequency, taskName, () => {
          self.api.log(`re-enqueued recurrent job ${taskName}`, self.api.config.tasks.schedulerLogging.reEnqueue);
          callback()
        })
      })
    })
  }

  /**
   * Enqueue all the recurrent jobs.
   *
   * @param callback  Callback function.
   */
  enqueueAllRecurrentJobs (callback) {
    let self = this
    let jobs = []
    let loadedTasks = []

    Object.keys(self.tasks).forEach(taskName => {
      // get task object
      let task = self.tasks[ taskName ]

      if (task.frequency > 0) {
        jobs.push(done => {
          self.enqueue(taskName, (error, toRun) => {
            if (error) { return done(error) }
            if (toRun === true) {
              self.api.log(`enqueuing periodic task ${taskName}`, self.api.config.tasks.schedulerLogging.enqueue)
              loadedTasks.push(taskName)
            }

            return done()
          })
        })
      }
    })

    async.series(jobs, error => {
      if (error) { return callback(error) }
      return callback(null, loadedTasks)
    })
  }

  /**
   * Remove a recurrent task from the queue.
   *
   * @param taskName  Task's name to be removed.
   * @param callback  Callback function.
   */
  stopRecurrentJob (taskName, callback) {
    let self = this
    let task = self.tasks[ taskName ]

    // if isn't a recurrent task execute the callback and return
    if (task.frequency <= 0) {
      callback()
      return
    }

    let removedCount = 0

    // remove the task from the recurrent queue
    self.del(task.queue, task.name, {}, 1, (err, count) => {
      removedCount = removedCount + count
      self.delDelayed(task.queue, task.name, {}, (err, timestamps) => {
        removedCount = removedCount + timestamps.length
        callback(err, removedCount)
      })
    })
  }

  /**
   * Get the current task queue state.
   *
   * @param callback  Callback function.
   */
  details (callback) {
    let self = this

    let result = {'queues': {}, 'workers': {}}
    let jobs = []

    // push all the workers to the result var
    jobs.push(done => {
      self.api.tasks.allWorkingOn((error, workers) => {
        if (error) { return done(error) }
        result.workers = workers
      })
    })

    // push all the queue to the result var
    jobs.push(done => {
      self.api.resque.queue.queues((error, queues) => {
        if (error) { return done(error) }
        let queueJobs = []

        queues.forEach(queue => {
          queueJobs.push(qDone => {
            self.resque.queue.length(queue, (error, length) => {
              if (error) { return qDone(error) }
              result.queues[ queue ] = {length: length}
              return qDone()
            })
          })
        })

        async.series(queueJobs, done)
      })
    })

    async.series(jobs, callback)
  }

}

/**
 * This loads the task features to the API object.
 */
export default class {

  /**
   * Satellite load priority.
   *
   * @type {number}
   */
  static loadPriority = 699

  /**
   * Satellite start priority.
   *
   * @type {number}
   */
  static startPriority = 900

  /**
   * Load the logic intro the API object.
   *
   * @param api   API reference.
   * @param next  Callback function.
   */
  static load (api, next) {
    // load task features to the API object
    api.tasks = new TaskSatellite(api)

    // load modules tasks
    api.tasks.loadModulesTasks()

    // finish the satellite initialization
    next()
  }

  /**
   * Satellite start function.
   *
   * @param api   API object reference.
   * @param next  Callback function.
   */
  static start (api, next) {
    if (api.config.tasks.scheduler === true) {
      api.tasks.enqueueAllRecurrentJobs((error) => next(error))
    } else {
      next()
    }
  }

}
