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
		let task = this.tasks[taskName];

		let plugins = task.plugins ?? [];
		let pluginOptions = task.pluginOptions ?? [];

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
			perform: async (...args) => {
				const taskArguments = [this.api, ...args];

				let response = null;
				try {
					response = await task.run.apply(task, taskArguments);
					await this.enqueueRecurrentJob(taskName);
				} catch (error) {
					if (task.frequency > 0 && task.reEnqueuePeriodicTaskIfException) {
						await this.enqueueRecurrentJob(taskName);
					}

					throw error;
				}

				return response;
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
		params ??= {};
		queue ??= this.tasks[taskName].queue;

		return this.api.resque.queue.enqueue(queue, taskName, params);
	}

	/**
	 * Enqueue a task and execute them in a given timestamp.
	 *
	 * @param  {Decimal}  timestamp Timestamp when the task must be executed.
	 * @param  {String}   taskName  Unique task identifier of the task to add.
	 * @param  {Object}   params    Parameters to be passed to the task.
	 * @param  {String}   queue     Queue where the task must be enqueued.
	 */
	enqueueAt(timestamp, taskName, params, queue) {
		queue ??= this.tasks[taskName].queue;
		params ??= {};

		return this.api.resque.queue.enqueueAt(timestamp, queue, taskName, params);
	}

	/**
	 * Enqueue a tasks and execute them with a delay.
	 *
	 * @param  {Decimal}  time     Delay in milliseconds.
	 * @param  {String}   taskName Unique identifier for the task to enqueue.
	 * @param  {Object}   params   Parameters to be passed to the task.
	 * @param  {String}   queue    Queue where the task will be enqueued.
	 */
	enqueueIn(time, taskName, params, queue) {
		params ??= {};
		queue ??= this.tasks[taskName].queue;

		return this.api.resque.queue.enqueueIn(time, queue, taskName, params);
	}

	/**
	 * Remove a task by name.
	 *
	 * @param  {String}   queue    Queue here the task are located.
	 * @param  {String}   taskName Unique identifier of the task to be removed.
	 * @param  {Object}   args     Arguments to pass to node-resque.
	 * @param  {Number}   count    Number of task entries to be removed.
	 */
	async del(queue, taskName, args, count) {
		return this.api.resque.queue.del(queue, taskName, args, count);
	}

	/**
	 * Remove a delayed task by name.
	 *
	 * @param  {String}   queue    Queue where the task must be removed.
	 * @param  {String}   taskName Task unique identifier.
	 * @param  {Object}   args     Arguments to pass to node-resque.
	 */
	async delDelayed(queue, taskName, args) {
		return this.api.resque.queue.delDelayed(queue, taskName, args);
	}

	/**
	 * Get the timestamps when a task will be executed.
	 *
	 * @param  {String}   queue    Queue identifier.
	 * @param  {String}   taskName Task unique identifier.
	 * @param  {Object}   args     Arguments to pass to node-resque.
	 */
	async scheduledAt(queue, taskName, args) {
		return this.api.resque.queue.scheduledAt(queue, taskName, args);
	}

	async stats() {
		return this.api.resque.queue.stats();
	}

	/**
	 * Get works queued between the given time interval.
	 *
	 * @param  {String}   queue    Queue to check.
	 * @param  {Decimal}  start    Start timestamp.
	 * @param  {Decimal}  stop     End timestamp.
	 */
	async queued(queue, start, stop) {
		return this.api.resque.queue.queued(queue, start, stop);
	}

	/**
	 * Remove a queue.
	 *
	 * @param  {String}   queue    Queue to be removed.
	 */
	async delQueue(queue) {
		return this.api.resque.queue.delQueue(queue);
	}

	/**
	 * Get the locks.
	 *
	 */
	async locks() {
		return this.api.resque.queue.locks();
	}

	/**
	 * Remove a lock.
	 *
	 * @param  {String}   lock     Lock to be removed.
	 */
	async delLock(lock) {
		return this.api.resque.queue.delLock(lock);
	}

	async timestamps() {
		return this.api.resque.queue.timestamps();
	}

	async delayedAt(timestamp) {
		return this.api.resque.queue.delayedAt(timestamp);
	}

	async allDelayed() {
		return this.api.resque.queue.allDelayed();
	}

	async workers() {
		return this.api.resque.queue.workers();
	}

	async workingOn(workerName, queues) {
		return this.api.resque.queue.workingOn(workerName, queues);
	}

	async allWorkingOn() {
		return this.api.resque.queue.allWorkingOn();
	}

	async failedCount() {
		return this.api.resque.queue.failedCount();
	}

	async failed(start, stop) {
		return this.api.resque.queue.failed(start, stop);
	}

	async removeFailed(failedJob) {
		return this.api.resque.queue.removeFailed(failedJob);
	}

	async retryAndRemoveFailed(failedJob) {
		return this.api.resque.queue.retryAndRemoveFailed(failedJob);
	}

	async cleanOldWorkers(age) {
		return this.api.resque.queue.cleanOldWorkers(age);
	}

	/**
	 * Enqueue recurrent job.
	 *
	 * @param taskName Task's name.
	 */
	async enqueueRecurrentJob(taskName) {
		// get task object
		let task = this.tasks[taskName];

		if (task.frequency <= 0) {
			return;
		}

		await this.del(task.queue, taskName, {});
		await this.delDelayed(task.queue, taskName, {});
		await this.enqueueIn(task.frequency, taskName);
		this.api.log(`re-enqueued recurrent job ${taskName}`, this.api.config.tasks.schedulerLogging.reEnqueue);
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
	 * @param name  Task's name to be removed.
	 */
	async stopRecurrentJob(name) {
		const job = this.tasks[name];

		if (job.frequency <= 0) {
			return;
		}

		let removedCount = 0;

		// remove the task from the recurrent queue
		const count = await this.del(job.queue, job.name, {}, 1);
		removedCount = removedCount + count;
		const timestamps = this.delDelayed(job.queue, job.name, {});

		return removedCount + timestamps.length;
	}

	/**
	 * Get the current task queue state.
	 */
	async details() {
		let result = { queues: {}, workers: {} };

		// push all the workers to the result var
		result.workers = await this.api.tasks.allWorkingOn();

		// push all the queue to the result var
		const queues = await this.api.resque.queue.queues();
		let queueJobs = [];

		queues.forEach((queue) => {
			queueJobs.push(async () => {
				const length = await this.resque.queue.length(queue);
				result.queues[queue] = { length: length };
			});
		});

		await Promise.all(queueJobs);
		return result;
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
	 */
	async load(api) {
		api.tasks = new TaskSatellite(api);
		await api.tasks.loadModulesTasks();
	}

	/**
	 * Satellite start function.
	 *
	 * @param api   API object reference.
	 */
	async start(api) {
		if (api.config.tasks.scheduler === true) {
			await api.tasks.enqueueAllRecurrentJobs();
		}
	}
}
