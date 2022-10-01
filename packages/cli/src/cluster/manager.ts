import cluster, { Worker } from "cluster";
import { existsSync } from "fs";
import { readFile, writeFile } from "fs/promises";
import { cpus } from "os";
import { join } from "path";
import { cwd } from "process";
import { always, isNil, mergeWith, when } from "ramda";
import { isFunction } from "ramda-adjunct";
import winston from "winston";
import { cliPath, createDirectory, isPidRunning } from "../utils.js";

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

type ClusterManager = {
  workers: Worker[];
  workersToRestart: string[];

  flapCount: number;
  flapTimer?: NodeJS.Timeout;

  options: Options;
  logger: winston.Logger;
};

let instance: ClusterManager | null = null;

export const getClusterManager = (): ClusterManager => {
  if (isNil(instance)) {
    throw new Error("The instance needs to be created first");
  }

  return instance;
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

const buildWorkerEnv = (manager: ClusterManager, workerId: number): Record<string, unknown> => {
  if (isFunction(manager.options.buildEnv)) {
    return manager.options.buildEnv(workerId);
  } else {
    return {
      title: `${manager.options.workerTitlePrefix}${workerId}`,
    };
  }
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

const createClusterManager = (args: Partial<Options>): void => {
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

  instance = {
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
