import { EngineStatus } from "@stellarfw/common";
import cluster, { Worker as ClusterWorker } from "cluster";
import { existsSync } from "fs";
import { readFile, writeFile } from "fs/promises";
import { cpus, hostname } from "os";
import path, { join } from "path";
import { cwd } from "process";
import {
  always,
  append,
  dec,
  groupBy,
  inc,
  isEmpty,
  isNil,
  last,
  length,
  lensPath,
  map,
  mergeWith,
  pipe,
  prop,
  set,
  when,
} from "ramda";
import { isFunction, isNotNil } from "ramda-adjunct";
import winston from "winston";
import { RunCommandArgs } from "../command.types";
import { cliPath, createDirectory, isPidRunning } from "../utils";

type Options = {
  id: string;
  silent: boolean;

  stopTimeout: number;
  flapWindow: number;

  execPath: string;
  tempPath: string;
  pidPath: string;
  pidFile: string;
  logPath: string;
  logFile: string;

  expectedWorkers: number;
  workerTitlePrefix: string;

  args: string;
  buildEnv: ((workerId: number) => Record<string, unknown>) | null;
};

type Worker = {
  id: number;
  state: EngineStatus;
  env: Record<string, unknown>;
  clusterWorker?: ClusterWorker;
};

const createWorker = (id: number, env: Record<string, unknown>): Worker => ({
  id,
  env,
  state: EngineStatus.Stopped,
});

const workerLogPrefix = (worker: Worker): string => {
  let s = `[worker #${worker.id}`;

  if (isNotNil(worker.clusterWorker?.process)) {
    s = `${s} (${worker.clusterWorker?.process.pid})`;
  }

  return `${s}]: `;
};

const workerLog = (worker: Worker, manager: ClusterManager, level: string, message: string) => {
  manager.logger.log(level, `${workerLogPrefix(worker)}${message}`);
};

const startWorker = (manager: ClusterManager, worker: Worker): Worker => {
  const clusterWorker = cluster.fork(worker.env);
  const newWorker = { ...worker, clusterWorker };

  // TODO: implement exit action
  clusterWorker.on("exit", () => {
    workerLog(newWorker, manager, "info", `exited`);
  });

  clusterWorker.process.stderr?.on("data", (chunk) => {
    const message = String(chunk);

    workerLog(newWorker, manager, "alert", `uncaught exception => ${message}`);
    manager.flapCount = inc(manager.flapCount);
  });

  // TODO: implement message action

  return newWorker;
};

const stopWorker = (worker: Worker) => worker.clusterWorker?.send("stopProcess");

const restartWorker = (worker: Worker) => worker.clusterWorker?.send("restart");

const buildWorkerEnv = (manager: ClusterManager, workerId: number): Record<string, unknown> => {
  if (isFunction(manager.options.buildEnv)) {
    return manager.options.buildEnv(workerId);
  } else {
    return {
      title: `${manager.options.workerTitlePrefix}${workerId}`,
    };
  }
};
type ClusterManager = {
  workers: Worker[];
  workersToRestart: string[];

  flapCount: number;
  flapTimer?: NodeJS.Timeout;

  options: Options;
  logger: winston.Logger;
};

const mergeFn = (def, val) => when(isNil, always(def))(val);
const withClusterDefaults = mergeWith<Options>(mergeFn, {
  id: "StellarCluster",
  silent: false,
  stopTimeout: 1000,
  expectedWorkers: cpus().length,
  flapWindow: 1000 * 30,
  execPath: cliPath,
  tempPath: join(cwd(), "temp"),
  pidPath: join(cwd(), "temp", "pids"),
  pidFile: "cluster_pidfile",
  logPath: join(cwd(), "temp", "logs"),
  logFile: "cluster.log",
  workerTitlePrefix: "stellar-worker-",
  args: "",
  buildEnv: null,
});

const createClusterManager = (args: Partial<Options>): ClusterManager => {
  const options = withClusterDefaults(args);

  const fileTransport = new winston.transports.File({
    filename: join(options.logPath, options.logFile),
  });
  // TODO: assign better type
  let loggerTransports: any[] = [fileTransport];

  if (cluster.isPrimary && !options.silent) {
    const customFormatter = winston.format.combine(winston.format.colorize(), winston.format.simple());
    const consoleTransport = new winston.transports.Console({ format: customFormatter });
    loggerTransports = [...loggerTransports, consoleTransport];
  }

  const logger = winston.createLogger({
    level: "debug",
    levels: winston.config.syslog.levels,
    transports: loggerTransports,
  });

  return {
    workers: [],
    workersToRestart: [],
    flapCount: 0,
    options,
    logger,
  };
};

const stopClusterManager = async (manager: ClusterManager): Promise<ClusterManager | boolean> => {
  if (isEmpty(manager.workers)) {
    manager.logger.log("notice", "all workers stopped");
    return true;
  }

  manager.logger.log("info", `${length(manager.workers)} workers running, waiting on stop`);
  // TODO: implement stop timeout check

  if (manager.options.expectedWorkers > 0) {
    const newManager = set(lensPath(["options", "expectedWorkers"]), 0, manager);
    return clusterTick(newManager);
  }

  return false;
};

const jobLogInitMessage = async (manager: ClusterManager) => {
  manager.logger.log("notice", "--- Starting Cluster ---");
  manager.logger.log("notice", `pid: ${process.pid}`);
};

/**
 * Ensure the default directories are created.
 */
const jobsCreateDefaultDirectories = async (manager: ClusterManager) => {
  await createDirectory(manager.options.tempPath);
  await createDirectory(manager.options.logPath);
  await createDirectory(manager.options.pidPath);
};

/**
 * Write the process pid on the file.
 */
const jobWritePidFile = async (manage: ClusterManager) => {
  const pidFile = join(manage.options.pidPath, manage.options.pidFile);

  // if the pid file already exists we throw an error. we can't have to instances of the same project running
  if (existsSync(pidFile)) {
    const oldContent = await readFile(pidFile);
    const oldPid = parseInt(oldContent.toString(), 10);

    if (isPidRunning(oldPid)) {
      throw new Error(`Stellar already running (pid ${oldPid})`);
    }
  }

  await writeFile(pidFile, process.pid.toString());
};

const jobFlapping = async (manager: ClusterManager) => {
  if (isNotNil(manager.flapTimer)) {
    clearTimeout(manager.flapTimer);
  }

  manager.flapTimer = setInterval(() => {
    if (manager.flapCount > manager.options.expectedWorkers * 2) {
      manager.logger.log(
        "emerg",
        `CLUSTER IS FLAPPING (${manager.flapCount} crashes in ${manager.options.flapWindow} ms). Stopping`,
      );

      stopClusterManager(manager).then(() => process.exit());
    } else {
      manager.flapCount = 0;
    }
  }, manager.options.flapWindow);
};

const startClusterManager = async (extManager: ClusterManager) => {
  // This manager will change each time an event happens
  let manager = extManager;
  const { logger, options } = extManager;

  logger.log("debug", JSON.stringify(manager.options));

  cluster.setupPrimary({
    exec: options.execPath,
    args: options.args.split(" "),
    silent: true,
  });

  process.on("SIGINT", () => {
    logger.log("info", "Signal: SIGINT");
    stopClusterManager(manager).then(() => process.exit());
  });

  process.on("SIGTERM", () => {
    logger.log("info", "Signal: SIGTERM");
    stopClusterManager(manager).then(() => process.exit());
  });

  process.on("SIGUSR2", () => {
    logger.log("info", "Signal: SIGUSR2");
    logger.log("info", "swap out new workers one-by-one");

    const workerIds = map(prop("id"), manager.workers);
    manager.workersToRestart = [...manager.workersToRestart, ...workerIds];

    manager = clusterTick(manager);
  });

  process.on("SIGHUP", () => {
    logger.log("info", "Signal: SIGHUP");
    logger.log("info", "reload all workers now");
    manager.workers.forEach(restartWorker);
  });

  process.on("SIGTTIN", () => {
    logger.log("info", "Signal: SIGTTIN");
    logger.log("info", "add a worker");
    manager.options.expectedWorkers = inc(manager.options.expectedWorkers);

    manager = clusterTick(manager);
  });

  process.on("SIGTTOU", () => {
    logger.log("info", "Signal: SIGTTOU");
    logger.log("info", "remove a worker");
    manager.options.expectedWorkers = dec(manager.options.expectedWorkers);

    manager = clusterTick(manager);
  });

  const jobs: ((manager: ClusterManager) => Promise<void>)[] = [
    jobLogInitMessage,
    jobFlapping,
    jobsCreateDefaultDirectories,
    jobWritePidFile,
  ];

  for (const job of jobs) {
    try {
      await job(manager);
    } catch (error) {
      manager.logger.log("error", error);
      process.exit(1);
    }
  }

  manager = clusterTick(manager);
};

const getFirstFreeId = (workers: Worker[]): number => {
  let id = 0;
  workers.forEach((worker) => {
    if (worker.id === id) {
      id = inc(id);
    }
  });

  return id;
};

const clusterTick = (manager: ClusterManager): ClusterManager => {
  // TODO: sort workers

  // group workers by state
  // TODO: make state not optional
  const stateCounts = groupBy<Worker>(prop("state"), manager.workers);
  console.log("🚀 ~ file: start-cluster.ts ~ line 267 ~ clusterTick ~ stateCounts", stateCounts);

  // if the state changes log a message to inform that
  if (
    manager.options.expectedWorkers < manager.workers.length &&
    isNil(stateCounts.stopping) &&
    isNil(stateCounts.stopped) &&
    isNil(stateCounts.restarting)
  ) {
    const worker = last(manager.workers) as Worker;
    manager.logger.log("info", `signaling worker #${worker?.id} to stop`);
    stopWorker(worker);
  } else if (
    manager.options.expectedWorkers > manager.workers.length &&
    isNil(stateCounts.starting) &&
    isNil(stateCounts.restarting)
  ) {
    const workerId = getFirstFreeId(manager.workers);
    const workerEnv = buildWorkerEnv(manager, workerId);
    const newWorker = createWorker(workerId, workerEnv);
    startWorker(manager, newWorker);
    manager = { ...manager, workers: append(newWorker, manager.workers) };
  }

  return manager;
};

export const startCluster = (args: RunCommandArgs) => {
  const options: Partial<Options> = {
    execPath: path.normalize(`${cliPath}/../bin/stellar.mjs`),
    args: "run",
    silent: !!args.silent,
    expectedWorkers: args.workers,
    id: args.id,
    buildEnv(workerId: number) {
      const env: Record<string, unknown> = {};

      // configure the environment variables
      for (const k in process.env) {
        env[k] = process.env[k];
      }

      let title = args.workerPrefix;

      // configure default worker name in the case of the user give us  an empty parameter
      if (isEmpty(title)) {
        title = "stellar-worker-";
      } else if (title === "hostname") {
        title = `${hostname()}-`;
      }

      title = `${title}${workerId}`;
      env.title = title;
      env.STELLAR_TITLE = title;

      return env;
    },
  };

  pipe(createClusterManager, startClusterManager)(options);
};
