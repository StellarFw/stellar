import { EngineStatus } from "@stellarfw/common";
import cluster, { Worker as ClusterWorker } from "cluster";
import { inc } from "ramda";
import { isNotNil } from "ramda-adjunct";

type Worker = {
  id: number;
  state: EngineStatus;
  env: Record<string, unknown>;
  clusterWorker?: ClusterWorker;
};

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

export const createWorker = (id: number, env: Record<string, unknown>): Worker => ({
  id,
  env,
  state: EngineStatus.Stopped,
});

export const startWorker = (manager: ClusterManager, worker: Worker): Worker => {
  const clusterWorker = cluster.fork(worker.env);
  const newWorker = { ...worker, clusterWorker };

  clusterWorker.on("exit", () => {
    workerLog(newWorker, manager, "info", `exited`);

    // TODO: remove worker
  });

  clusterWorker.process.stderr?.on("data", (chunk) => {
    const message = String(chunk);

    workerLog(newWorker, manager, "alert", `uncaught exception => ${message}`);
    manager.flapCount = inc(manager.flapCount);
  });

  // TODO: implement message action

  return newWorker;
};

export const stopWorker = (worker: Worker) => worker.clusterWorker?.send("stopProcess");

export const restartWorker = (worker: Worker) => worker.clusterWorker?.send("restart");
