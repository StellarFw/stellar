import async from "async";

class TaskSatellite {
	/**
	 * API reference object.
	 *
	 * @type {null}
	 */
	api = null;

	/**
	 * Map with the registered tasks.
	 *
	 * @type {{}}
	 */
	tasks = {};

	/**
	 * Map with the jobs.
	 *
	 * @type {Map}
	 */
	jobs = {};

	/**
	 * Create a new TaskSatellite instance and save the API object.
	 *
	 * @param api   API reference object.
	 */
	constructor(api) {
		this.api = api;
	}

	/**
	 * Load a task file intro the task manager.
	 *
	 * @param fullFilePath  Full task file path.
	 * @param reload        This should be true is a reload.
	 */
	async loadFile(fullFilePath, reload = false) {
		// function to be used to log the task (re)load
		let loadMessage = (loadedTasksName) => {
			const level = reload ? "info" : "debug";
			const reloadWord = reload ? "(re)" : "";

			this.api.log(`task ${reloadWord}loaded: ${loadedTasksName}, ${fullFilePath}`, level);
		};

		// start watch for file changes
		this.api.configs.watchFileAndAct(fullFilePath, () => this.loadFile(fullFilePath, true));

		// temporary task info
		let task = null;

		try {
			// get task collection
			let collection = await import(`${fullFilePath}?cache=${Date.now()}`);

			// iterate all collections
			for (let i in collection) {
				// get task logic
				task = collection[i];

				// create a new task entry
				this.tasks[task.name] = task;

				// validate task
				if (this._validateTask(this.tasks[task.name]) === false) {
					return;
				}

				// create a job wrapper on the new task
				this.jobs[task.name] = this._jobWrapper(task.name);

				// log the load message
				loadMessage(task.name);
			}
		} catch (err) {
			this.api.log(`[TaskSatellite::loadFile] ${err}`);

			// handle the exception
			this.api.exceptionHandlers.loader(fullFilePath, err);

			// remove the task if that exists
			delete this.tasks[task.name];
			delete this.jobs[task.name];
		}
	}

	/**
	 * Wrapper the task in a job.
	 *
	 * @param taskName  Task name.
	 * @returns {{plugins: (Array|*), pluginsOptions: (*|Array), perform: (function())}}
	 * @private
	 */
	_jobWrapper(taskName) {
		// get task object
		let task = this.tasks[taskName];

		// get tasks plugins
		let plugins = task.plugins || [];

		// get plugin options
		let pluginOptions = task.pluginOptions || [];

		// check if the task uses some kind of plugins
		if (task.frequency > 0) {
			if (plugins.indexOf("JobLock") < 0) {
				plugins.push("JobLock");
				pluginOptions.JobLock = { reEnqueue: false };
			}
			if (plugins.indexOf("QueueLock") < 0) {
				plugins.push("QueueLock");
			}
			if (plugins.indexOf("DelayQueueLock") < 0) {
				plugins.push("DelayQueueLock");
			}
		}

		return {
			plugins: plugins,
			pluginsOptions: pluginOptions,
			perform: (...args) => {
				// get the callback function
				let cb = args.pop();

				if (args.length === 0) {
					args.push({});
				}

				// enqueue the task again
				args.push((error, resp) => {
					this.enqueueRecurrentJob(taskName, () => {
						cb(error, resp);
					});
				});

				// add the API object at the begin of the arguments array
				args.unshift(this.api);

				// execute the task
				this.tasks[taskName].run.apply(this, args);
			},
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
	_validateTask(task) {
		// function to be executed in case of the task validation fails
		let fail = (msg) => this.api.log(`${msg}; exiting`, "emerg");

		if (typeof task.name !== "string" || task.name.length < 1) {
			fail("a task is missing 'task.name'");
			return false;
		} else if (typeof task.description !== "string" || task.description.length < 1) {
			fail(`Task '${task.name}' is missing 'task.description'`);
			return false;
		} else if (typeof task.frequency !== "number") {
			fail(`Task '${task.name}' has no frequency`);
			return false;
		} else if (typeof task.queue !== "string") {
			fail(`Task '${task.name}' has no queue`);
			return false;
		} else if (typeof task.run !== "function") {
			fail(`Task '${task.name}' has no run method`);
			return false;
		}

		return true;
	}

	/**
	 * Load all modules tasks.
	 *
	 * Iterate all active modules to load their tasks, if exists.
	 */
	async loadModulesTasks() {
		for (const modulePath of this.api.modules.modulesPaths.values()) {
			// build the task folder path for the current module
			let tasksFolder = `${modulePath}/tasks`;

			// load task files
			const taskFiles = this.api.utils.recursiveDirectoryGlob(tasksFolder);
			for (const taskFile of taskFiles) {
				await this.loadFile(taskFile);
			}
		}
	}

	// -------------------------------------------------------------------------------------------- [ways to queue a task]

	/**
	 * Enqueue a new job, normally.
	 *
	 * @param  {String}   taskName Unique task identifier.
	 * @param  {Array}    params   Parameters to be passed to the task.
	 * @param  {String}   queue    Queue here the task must be enqueued.
	 */
	async enqueue(taskName, params, queue) {
		params = params ?? {};
		queue = queue ?? this.tasks[taskName].queue;

		return this.api.resque.queue.enqueue(queue, taskName, params);
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
	enqueueAt(timestamp, taskName, params, queue, callback) {
		if (typeof queue === "function" && callback === undefined) {
			callback = queue;
			queue = this.tasks[taskName].queue;
		} else if (typeof params === "function" && callback === undefined && queue === undefined) {
			callback = params;
			queue = this.tasks[taskName].queue;
			params = {};
		}
		this.api.resque.queue.enqueueAt(timestamp, queue, taskName, params, callback);
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
	enqueueIn(time, taskName, params, queue, callback) {
		if (typeof queue === "function" && callback === undefined) {
			callback = queue;
			queue = this.tasks[taskName].queue;
		} else if (typeof params === "function" && callback === undefined && queue === undefined) {
			callback = params;
			queue = this.tasks[taskName].queue;
			params = {};
		}

		this.api.resque.queue.enqueueIn(time, queue, taskName, params, callback);
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
	del(queue, taskName, args, count, callback) {
		this.api.resque.queue.del(queue, taskName, args, count, callback);
	}

	/**
	 * Remove a delayed task by name.
	 *
	 * @param  {String}   queue    Queue where the task must be removed.
	 * @param  {String}   taskName Task unique identifier.
	 * @param  {Object}   args     Arguments to pass to node-resque.
	 * @param  {Function} callback Callback function.
	 */
	delDelayed(queue, taskName, args, callback) {
		this.api.resque.queue.delDelayed(queue, taskName, args, callback);
	}

	/**
	 * Get the timestamps when a task will be executed.
	 *
	 * @param  {String}   queue    Queue identifier.
	 * @param  {String}   taskName Task unique identifier.
	 * @param  {Object}   args     Arguments to pass to node-resque.
	 * @param  {Function} callback Callback function.
	 */
	scheduledAt(queue, taskName, args, callback) {
		this.api.resque.queue.scheduledAt(queue, taskName, args, callback);
	}

	stats(callback) {
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
	queued(queue, start, stop, callback) {
		this.api.resque.queue.queued(queue, start, stop, callback);
	}

	/**
	 * Remove a queue.
	 *
	 * @param  {String}   queue    Queue to be removed.
	 * @param  {Function} callback Callback function.
	 */
	delQueue(queue, callback) {
		this.api.resque.queue.delQueue(queue, callback);
	}

	/**
	 * Get the locks.
	 *
	 * @param  {Function} callback Callback function.
	 */
	locks(callback) {
		this.api.resque.queue.locks(callback);
	}

	/**
	 * Remove a lock.
	 *
	 * @param  {String}   lock     Lock to be removed.
	 * @param  {Function} callback Callback function.
	 */
	delLock(lock, callback) {
		this.api.resque.queue.delLock(lock, callback);
	}

	timestamps(callback) {
		this.api.resque.queue.timestamps(callback);
	}

	delayedAt(timestamp, callback) {
		this.api.resque.queue.delayedAt(timestamp, callback);
	}

	allDelayed(callback) {
		this.api.resque.queue.allDelayed(callback);
	}

	workers(callback) {
		this.api.resque.queue.workers(callback);
	}

	workingOn(workerName, queues, callback) {
		this.api.resque.queue.workingOn(workerName, queues, callback);
	}

	allWorkingOn(callback) {
		this.api.resque.queue.allWorkingOn(callback);
	}

	failedCount(callback) {
		this.api.resque.queue.failedCount(callback);
	}

	failed(start, stop, callback) {
		this.api.resque.queue.failed(start, stop, callback);
	}

	removeFailed(failedJob, callback) {
		this.api.resque.queue.removeFailed(failedJob, callback);
	}

	retryAndRemoveFailed(failedJob, callback) {
		this.api.resque.queue.retryAndRemoveFailed(failedJob, callback);
	}

	cleanOldWorkers(age, callback) {
		this.api.resque.queue.cleanOldWorkers(age, callback);
	}

	/**
	 * Enqueue recurrent job.
	 *
	 * @param taskName Task's name.
	 * @param callback Callback function.
	 */
	enqueueRecurrentJob(taskName, callback) {
		// get task object
		let task = this.tasks[taskName];

		// if it isn't a periodic task execute the callback function and return
		if (task.frequency <= 0) {
			callback();
			return;
		}

		this.del(task.queue, taskName, {}, () => {
			this.delDelayed(task.queue, taskName, {}, () => {
				this.enqueueIn(task.frequency, taskName, () => {
					this.api.log(`re-enqueued recurrent job ${taskName}`, this.api.config.tasks.schedulerLogging.reEnqueue);
					callback();
				});
			});
		});
	}

	/**
	 * Enqueue all the recurrent jobs.
	 */
	async enqueueAllRecurrentJobs() {
		let loadedTasks = [];

		for (const taskName of Object.keys(this.tasks)) {
			let task = this.tasks[taskName];

			if (task.frequency > 0) {
				const toRun = await this.enqueue(taskName);

				if (toRun === true) {
					this.api.log(`enqueuing periodic task ${taskName}`, this.api.config.tasks.schedulerLogging.enqueue);
					loadedTasks.push(taskName);
				}
			}
		}

		return loadedTasks;
	}

	/**
	 * Remove a recurrent task from the queue.
	 *
	 * @param taskName  Task's name to be removed.
	 * @param callback  Callback function.
	 */
	stopRecurrentJob(taskName, callback) {
		let task = this.tasks[taskName];

		// if isn't a recurrent task execute the callback and return
		if (task.frequency <= 0) {
			callback();
			return;
		}

		let removedCount = 0;

		// remove the task from the recurrent queue
		this.del(task.queue, task.name, {}, 1, (_, count) => {
			removedCount = removedCount + count;
			this.delDelayed(task.queue, task.name, {}, (error, timestamps) => {
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
	details(callback) {
		let result = { queues: {}, workers: {} };
		let jobs = [];

		// push all the workers to the result var
		jobs.push((done) => {
			this.api.tasks.allWorkingOn((error, workers) => {
				if (error) {
					return done(error);
				}
				result.workers = workers;
			});
		});

		// push all the queue to the result var
		jobs.push((done) => {
			this.api.resque.queue.queues((error, queues) => {
				if (error) {
					return done(error);
				}
				let queueJobs = [];

				queues.forEach((queue) => {
					queueJobs.push((qDone) => {
						this.resque.queue.length(queue, (error, length) => {
							if (error) {
								return qDone(error);
							}
							result.queues[queue] = { length: length };
							return qDone();
						});
					});
				});

				async.series(queueJobs, done);
			});
		});

		async.series(jobs, callback);
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
	loadPriority = 699;

	/**
	 * Satellite start priority.
	 *
	 * @type {number}
	 */
	startPriority = 900;

	/**
	 * Load the logic intro the API object.
	 *
	 * @param api   API reference.
	 * @param next  Callback function.
	 */
	async load(api, next) {
		api.tasks = new TaskSatellite(api);
		await api.tasks.loadModulesTasks();
		next();
	}

	/**
	 * Satellite start function.
	 *
	 * @param api   API object reference.
	 * @param next  Callback function.
	 */
	async start(api, next) {
		if (api.config.tasks.scheduler === true) {
			try {
				await api.tasks.enqueueAllRecurrentJobs();
			} catch (error) {
				next(error);
			}
		}

		next();
	}
}
