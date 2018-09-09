import { Satellite } from "../satellite";
import { LogLevel } from "../log-level.enum";
import { TaskInterface } from "../task.interface";

export interface InternalJob {
  plugins: Array<any>;
  pluginsOptions: Array<any>;
  perform: () => Promise<any>;
}

export default class TasksSatellite extends Satellite {
  protected _name: string = "tasks";
  public loadPriority: number = 699;
  public startPriority: number = 900;

  public jobs: Map<string, InternalJob> = new Map();

  /**
   * List of loaded tasks.
   */
  public tasks: { [key: string]: TaskInterface } = {};

  /**
   * Wrapper the task in a job.
   */
  private jobWrapper(taskName: string): InternalJob {
    const task = this.tasks[taskName];
    const plugins = task.plugins || [];
    const pluginOptions = task.pluginOptions || [];

    if (task.frequency > 0) {
      if (plugins.indexOf("jobLock") < 0) {
        plugins.push("jobLock");
      }
      if (plugins.indexOf("queueLock") < 0) {
        plugins.push("queueLock");
      }
      if (plugins.indexOf("delayQueueLock") < 0) {
        plugins.push("delayQueueLock");
      }
    }

    const taskWrapper: InternalJob = {
      plugins,
      pluginsOptions: pluginOptions,
      async perform() {
        const args = Array.prototype.slice.call(arguments);

        if (args.length === 0) {
          args.push({});
        }

        const response = await task.run.apply({ api: this.api, task }, args);
        await this.enqueueRecurrentJob(taskName);
        return response;
      },
    };

    return taskWrapper;
  }

  /**
   * Validate a task.
   *
   * TODO: throw exception instead of return `false`
   *
   * For the task to be valid it must contain the follow properties:
   *  - name
   *  - description
   *  - frequency
   *  - queue
   *  - run
   */
  private validateTask(task: TaskInterface): boolean {
    // function to be executed in case of the task validation fails
    const fail = msg => this.api.log(`${msg}; exiting`, LogLevel.Emergency);

    if (typeof task.name !== "string" || task.name.length < 1) {
      fail(`a task is missing 'task.name'`);
      return false;
    } else if (
      typeof task.description !== "string" ||
      task.description.length < 1
    ) {
      fail(`Task ${task.name} is missing 'task.description'`);
      return false;
    } else if (typeof task.frequency !== "number") {
      fail(`Task ${task.name} has no frequency`);
      return false;
    } else if (typeof task.queue !== "string") {
      fail(`Task ${task.name} has no queue`);
      return false;
    } else if (typeof task.run !== "function") {
      fail(`Task ${task.name} has no run method`);
      return false;
    }

    return true;
  }

  /**
   * Load task file.
   *
   * @param path Task path.
   * @param reload Set to true when it's a reloaded.
   */
  private loadFile(path: string, reload: boolean = false): void {
    const loadMessage = loadedTasksName => {
      const level = reload ? LogLevel.Info : LogLevel.Debug;
      const reloadWord = reload ? "(re)" : "";
      this.api.log(
        `task ${reloadWord}loaded: ${loadedTasksName}, ${path}`,
        level,
      );
    };

    // start watch for file changes
    this.api.config.watchFileAndAct(path, () => this.loadFile(path, true));

    // temporary task info
    let task = null;

    try {
      const collection = require(path);

      for (const i in collection) {
        if (!collection.hasOwnProperty(i)) {
          continue;
        }

        task = collection[i];

        // create a new task entry
        this.tasks[task.name] = task;

        // validate task
        if (this.validateTask(task) === false) {
          return;
        }

        // create a job wrapper on the new task
        this.jobs[task.name] = this.jobWrapper(task.name);

        // log the load message
        loadMessage(task.name);
      }
    } catch (err) {
      this.api.log(`[TaskSatellite::loadFile] ${err}`, LogLevel.Warning);

      this.api.exceptionHandlers.loader(path, err);

      delete this.tasks[task.name];
      delete this.jobs[task.name];
    }
  }

  /**
   * Load all modules tasks.
   *
   * Iterate all active modules and load all tasks.
   */
  private loadModulesTasks(): void {
    this.api.modules.modulesPaths.forEach(modulePath => {
      const tasksFolder = `${modulePath}/tasks`;
      this.api.utils
        .recursiveDirSearch(tasksFolder)
        .forEach(f => this.loadFile(f));
    });
  }

  /**
   * Enqueue a new job, normally.
   *
   * @param taskName Unique task identifier.
   * @param params Parameters to be passed to the task
   * @param queue Queue where the task must be enqueued.
   */
  public enqueue(
    taskName: string,
    params: {} = {},
    queue: string = null,
  ): Promise<void> {
    if (!queue) {
      queue = this.tasks[taskName].queue;
    }

    return this.api.resque.queue.enqueue(queue, taskName, params);
  }

  /**
   * Enqueue a task and execute it on the given timestamp.
   *
   * @param timestamp Timestamp when the task must be executed.
   * @param taskName Unique task identifier of the task to add.
   * @param params Parameters to be passed to the task.
   * @param queue Queue where the task must be enqueued.
   */
  public enqueueAt(
    timestamp: number,
    taskName: string,
    params: {} = {},
    queue: string = null,
  ): Promise<void> {
    if (!queue) {
      queue = this.tasks[taskName].queue;
    }

    return this.api.resque.queue.enqueueAt(timestamp, queue, taskName, params);
  }

  /**
   * Enqueue a task and execute them with a delay.
   *
   * @param time Delay in milliseconds.
   * @param taskName Unique identifier for the task to enqueue.
   * @param params Parameters to be passed to the task.
   * @param queue Queue where the task must be enqueued.
   */
  public enqueueIn(
    time: number,
    taskName: string,
    params: {} = {},
    queue: string = null,
  ): Promise<any> {
    if (!queue) {
      queue = this.tasks[taskName].queue;
    }

    return this.api.resque.queue.enqueueIn(time, queue, taskName, params);
  }

  /**
   * Remove a task by name.
   *
   * @param queue Queue here the task are located.
   * @param taskName Unique identifier of the task to be removed.
   * @param args Arguments to pass to node-reques.
   * @param count Number of tasks entires to be removed.
   */
  public del(
    queue: string,
    taskName: string,
    args: {} = {},
    count: number = 0,
  ): Promise<number> {
    return this.api.resque.queue.del(queue, taskName, args, count);
  }

  /**
   * Remove a delayed task by name.
   *
   * @param queue Queue where the task must be removed.
   * @param taskName Task unique identifier.
   * @param args Arguments to pass to node-resque.
   */
  public delDelayed(
    queue: string,
    taskName: string,
    args: {} = {},
  ): Promise<Array<any>> {
    return this.api.resque.queue.delDelayed(queue, taskName, args);
  }

  /**
   * Get the timestamp that when a task will be executed.
   *
   * @param queue Queue here the information must be getter.
   * @param taskName Target task
   * @param args Arguments to pass to node-resque
   */
  public scheduledAt(
    queue: string,
    taskName: string,
    args: {} = {},
  ): Promise<void> {
    return this.api.resque.queue.scheduledAt(queue, taskName, args);
  }

  /**
   * Get stats.
   */
  public stats(): Promise<{}> {
    return this.api.resque.queue.stats();
  }

  /**
   * Get work queued between te given time interval.
   *
   * @param queue Queue to check.
   * @param start Start timestamp.
   * @param stop End timestamp.
   */
  public queued(queue: string, start: number, stop: number): Promise<void> {
    return this.api.resque.queue.queued(queue, start, stop);
  }

  /**
   * Remove an entire queue.
   *
   * @param queue Queue to be deleted.
   */
  public delQueue(queue: string) {
    return this.api.resque.queue.delQueue(queue);
  }

  /**
   * Get all enabled locks.
   */
  public locks(): Promise<Array<string>> {
    return this.api.resque.queue.locks();
  }

  /**
   * Remove a lock.
   *
   * @param lock Lock to be removed.
   */
  public delLock(lock: string): Promise<void> {
    return this.api.resque.queue.delLock(lock);
  }

  /**
   * Get all timestamps when a task delayed will be executed.
   */
  public timestamps(): Promise<Array<number>> {
    return this.api.resque.queue.timestamps();
  }

  /**
   * Check if there is any task to be executed on the given timestamp.
   *
   * @param timestamp Timestamp to be checked
   */
  public delayedAt(timestamp: number): Promise<Array<string>> {
    return this.api.resque.queue.delayedAt(timestamp);
  }

  /**
   * Get all delayed tasks.
   */
  public allDelayed(): Array<Array<string>> {
    return this.api.resque.queue.allDelayed();
  }

  /**
   * Return all workers registered by all cluster's members.
   */
  public workers(): Promise<Array<string>> {
    return this.api.resque.queue.workers();
  }

  /**
   * Return all work that is being possessed by the given worker.
   *
   * @param workerName Worker name.
   * @param queues Queues to check on.
   */
  public workingOn(workerName: string, queues: Array<string>): Promise<string> {
    return this.api.resque.queue.workingOn(workerName, queues);
  }

  /**
   * Return all workers and what they are working on.
   */
  public allWorkingOn(): Promise<Array<any>> {
    return this.api.resque.queue.allWorkingOn();
  }

  /**
   * Get the number of jobs that are on the failed queue.
   */
  public failedCount(): Promise<number> {
    return this.api.resque.queue.failedCount();
  }

  /**
   * Retrieve the details of the failed jobs between the two timestamp
   *
   * @param start Start timestamp.
   * @param stop End timestamp.
   */
  public failed(start: number, stop: number): Promise<any> {
    return this.api.resque.queue.failed(start, stop);
  }

  /**
   * Remove failed job.
   *
   * @param failedJob name of the failed jobs.
   */
  public removeFailed(failedJob: string): Promise<any> {
    return this.api.resque.queue.removeFailed(failedJob);
  }

  /**
   * Retry the failed job and remove it from the failed queue.
   *
   * @param failedJob name of the failed jobs.
   */
  public retryAndRemoveFailed(failedJob: string): Promise<void> {
    return this.api.resque.queue.retryAndRemoveFailed(failedJob);
  }

  /**
   * If a worker process crashes, it will leave its state
   * in redis as "working".
   *
   * @param age Max age to kill.The age of workers you know to
   * be over, in seconds.
   */
  public cleanOldWorkers(age: number): Promise<void> {
    return this.api.resque.queue.cleanOldWorkers(age);
  }

  /**
   * Ensures that a task which has a frequency is either running or enqueued.
   *
   * @param taskName The name of the task.
   */
  public async enqueueRecurrentTask(taskName: string): Promise<void> {
    const task = this.tasks[taskName];

    if (task.frequency <= 0) {
      return;
    }

    await this.del(task.queue, taskName);
    await this.delDelayed(task.queue, taskName);
    await this.enqueueIn(task.frequency, taskName);
    this.api.log(
      `re-enqueued recurrent job ${taskName}`,
      this.api.configs.tasks.schedulerLogging.reEnqueue,
    );
  }

  /**
   * Enqueue all the recurrent jobs.
   */
  public enqueueAllRecurrentTasks() {
    const jobs = [];
    const loadedTasks = [];

    Object.keys(this.tasks).forEach(taskName => {
      const task = this.tasks[taskName];

      if (task.frequency <= 0) {
        return;
      }

      jobs.push(async () => {
        const toRun = await this.enqueue(taskName);
        if (!toRun) {
          return;
        }
        this.api.log(
          `enqueuing periodic task ${taskName}`,
          this.api.config.tasks.schedulerLogging.enqueue,
        );
        loadedTasks.push(taskName);
      });
    });

    return Promise.all(jobs);
  }

  /**
   * Remove a recurrent task from the queue.
   *
   * @param taskName Task's name to be removed
   */
  public async stopRecurrentJob(taskName: string): Promise<number> {
    const task = this.tasks[taskName];

    if (task.frequency <= 0) {
      return;
    }

    // remove the task from the recurrent queue
    let removedCount = await this.del(task.queue, task.name, {}, 1);
    const timestamps = await this.delDelayed(task.queue, task.name, {});
    removedCount = removedCount + timestamps.length;

    return removedCount;
  }

  /**
   * Return details about the whole task system, including failures,
   * queues, and workers.
   */
  public async details(): Promise<{}> {
    const details = {
      queues: {},
      workers: {},
      stats: {},
    };

    details.workers = await this.allWorkingOn();
    details.stats = await this.stats();

    const queues = await this.api.resque.queue.queues();

    for (const key in Object.keys(queues)) {
      if (!queues.hasOwnProperty(key)) {
        continue;
      }

      const queue = queues[key];
      const length = await this.api.queue.length(queue);
      details.queues[queue] = {
        length,
      };
    }

    return details;
  }

  public async load(): Promise<void> {
    this.api.tasks = this;
    this.loadModulesTasks();
  }

  public async start(): Promise<void> {
    if (this.api.configs.tasks.scheduler === true) {
      await this.enqueueAllRecurrentTasks();
    }
  }
}
