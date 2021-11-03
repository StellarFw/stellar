import { Satellite } from "@stellarfw/common/lib";

import * as NodeResque from "node-resque";
import { LogLevel } from "@stellarfw/common/lib/enums/log-level.enum";

export default class ResqueSatellite extends Satellite {
  protected _name: string = "resque";
  public loadPriority = 600;
  public startPriority = 200;
  public stopPriority = 100;

  /**
   * Node-resque instance.
   *
   * TODO: find types for NodeResque
   */
  public queue: any;

  /**
   * Node-resque Scheduler.
   */
  private scheduler: any = null;

  /**
   * Connection information.
   */
  private connectionDetails: any = null;

  /**
   * Instance of the MultiWorker wrapper.
   */
  private multiWorker: any = null;

  /**
   * Logging levels for the task scheduler.
   */
  private schedulerLogging: { [key: string]: LogLevel } = {};

  private async startQueue() {
    this.queue = new NodeResque.Queue(
      {
        connection: this.connectionDetails,
      },
      this.api.tasks.jobs,
    );

    this.queue.on("error", (error) => this.api.log(error, LogLevel.Error, "[api.resque.scheduler]"));

    await this.queue.connect();
  }

  public async startMultiworker(): Promise<void> {
    const workerLogging = this.api.configs.tasks.workerLogging;
    const schedulerLogging = this.api.configs.tasks.schedulerLogging;

    // create a new multiworker instance
    this.multiWorker = new NodeResque.MultiWorker(
      {
        connection: this.connectionDetails,
        queues: this.api.configs.tasks.queues,
        timeout: this.api.configs.tasks.timeout,
        checkTimeout: this.api.configs.tasks.checkTimeout,
        minTaskProcessors: this.api.configs.tasks.minTaskProcessors,
        maxTaskProcessors: this.api.configs.tasks.maxTaskProcessors,
        maxEventLoopDelay: this.api.configs.tasks.maxEventLoopDelay,
        toDisconnectProcessors: this.api.configs.tasks.toDisconnectProcessors,
      },
      this.api.tasks.jobs,
    );

    // normal worker emitters
    this.multiWorker.on("start", (workerId) =>
      this.api.log("worker: started", workerLogging.start, {
        workerId,
      }),
    );
    this.multiWorker.on("end", (workerId) =>
      this.api.log("worker: ended", workerLogging.end, {
        workerId,
      }),
    );
    this.multiWorker.on("cleaning_worker", (workerId, worker, pid) =>
      this.api.log(`worker: cleaning old worker ${worker}, (${pid})`, workerLogging.cleaning_worker),
    );
    this.multiWorker.on("job", (workerId, queue, job) =>
      this.api.log(`worker: working job ${queue}`, workerLogging.job, {
        workerId,
        job: { class: job.class, queue: job.queue },
      }),
    );
    this.multiWorker.on("reEnqueue", (workerId, queue, job, plugin) =>
      this.api.log("worker: reEnqueue job", workerLogging.reEnqueue, {
        workerId,
        plugin,
        job: { class: job.class, queue: job.queue },
      }),
    );
    this.multiWorker.on("success", (workerId, queue, job, result) =>
      this.api.log(`worker: job success ${queue}`, workerLogging.success, {
        workerId,
        job: { class: job.class, queue: job.queue },
        result,
      }),
    );
    this.multiWorker.on("pause", (workerId) => this.api.log("worker: paused", workerLogging.pause, { workerId }));

    this.multiWorker.on("failure", (workerId, queue, job, failure) =>
      this.api.exceptionHandlers.task(failure, queue, job),
    );
    this.multiWorker.on("error", (error, workerId, queue, job) => {
      this.api.exceptionHandlers.task(error, queue, job);
    });

    // multiWorker emitters
    this.multiWorker.on("internalError", (error) => this.api.log(error, workerLogging.internalError));

    if (this.api.configs.tasks.minTaskProcessors > 0) {
      this.multiWorker.start();
    }
  }

  private async startScheduler(): Promise<void> {
    if (this.api.configs.tasks.scheduler !== true) {
      return;
    }

    this.schedulerLogging = this.api.configs.tasks.schedulerLogging;

    this.scheduler = new NodeResque.Scheduler({
      connection: this.connectionDetails,
      timeout: this.api.configs.tasks.timeout,
    });

    this.scheduler.on("error", (error) => this.api.log(error, LogLevel.Error, "[api.resque.scheduler]"));

    await this.scheduler.connect();

    this.scheduler.on("start", () => this.api.log("resque scheduler started", this.schedulerLogging.start));
    this.scheduler.on("end", () => this.api.log("resque scheduler ended", this.schedulerLogging.end));
    this.scheduler.on("poll", () => this.api.log("resque scheduler polling", this.schedulerLogging.poll));
    this.scheduler.on("working_timestamp", (timestamp) =>
      this.api.log(`resque scheduler working timestamp ${timestamp}`, this.schedulerLogging.working_timestamp),
    );
    this.scheduler.on("transferred_job", (timestamp, job) =>
      this.api.log(`resque scheduler enqueuing job ${timestamp}`, this.schedulerLogging.transferred_job, job),
    );

    await this.scheduler.start();
  }

  /**
   * Stop scheduler.
   */
  private async stopScheduler() {
    if (!this.scheduler) {
      return;
    }

    await this.scheduler.end();
    this.scheduler = null;
  }

  /**
   * Stop multiworker system.
   */
  private async stopMultiWorker() {
    if (this.multiWorker && this.api.configs.tasks.minTaskProcessors > 0) {
      await this.multiWorker.stop();
      this.multiWorker = null;

      this.api.log("Task workers stopped");
    }
  }

  /**
   * Stop queue.
   */
  private stopQueue() {
    if (this.queue) {
      return this.queue.end();
    }
  }

  public async load(): Promise<void> {
    this.connectionDetails = { redis: this.api.redis.clients.tasks };
  }

  public async start(): Promise<void> {
    if (this.api.configs.tasks.minTaskProcessors === 0 && this.api.configs.tasks.maxTaskProcessors > 0) {
      this.api.configs.tasks.minTaskProcessors = 1;
    }

    await this.startQueue();
    await this.startScheduler();
    await this.startMultiworker();
  }

  public async stop(): Promise<void> {
    await this.stopScheduler();
    await this.stopMultiWorker();
    await this.stopQueue();
  }
}
