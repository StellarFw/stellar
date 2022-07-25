import { LogLevel, Option, option, unsafeAsync } from "@stellarfw/common/lib/index.js";
import { Engine } from "@stellarfw/core/lib/index.js";
import { Command } from "commander";
import { RunCommandArgs } from "../command.types";

type State = {
  engine: Engine;
};

const stopProcess = (engine: Engine, shutdownTimeout: Option<number>) => async () => {
  // put a time limit to shutdown the server gracefully
  setTimeout(() => process.exit(1), shutdownTimeout.unwrapOr(0));

  await engine.stop();
  process.nextTick(() => process.exit());
};

const startServer = (engine: Engine) => {
  unsafeAsync(() => engine.start()).then((result) =>
    result.tapErr((msg) => {
      console.error("[INTERNAL ERROR]", msg);
      process.exit(1);
    }),
  );
};

const execRunCommand = async (args: RunCommandArgs) => {
  // when the cluster mode is required by the user, stop the normal run command and move to cluster mode
  if (!!args.cluster) {
    (await import("../start-cluster.js")).startCluster(args);
    return;
  }

  //number of ms to wait to do a force shutdown if the Stellar won't stop gracefully
  const shutdownTimeout = option(process.env.STELLAR_SHUTDOWN_TIMEOUT).map((v) => parseInt(v, 10));

  // TODO: implement cluster mode

  // build and initialize Stellar, this will give us access to the config satellite
  const scope = { rootPath: process.cwd(), args };
  const engine = new Engine(scope);
  await engine.initialize();

  // define the action to be performed when a particular event occurs
  const stopProcessFn = stopProcess(engine, shutdownTimeout);
  process.on("SIGINT", stopProcessFn);
  process.on("SIGTERM", stopProcessFn);
  process.on("SIGUSR2", () => engine.restart());

  startServer(engine);
};

export const runCommand = new Command("run")
  .description("Start a new Stellar instance")
  .option("--prod", "Enable production mode")
  .option("--port <port>", "Port where the HTTP server will listening", "8080")
  .option("--clean", "Remove all temporary files and dependencies")
  .option("--update", "Update dependencies")
  .option("--cluster", "Run Stellar as a cluster")
  .option("--id", "Cluster identifier")
  .option("--silent", "No messages will be printed to the console")
  .option("--workers <number>", "Number of workers")
  .option(
    "--workerPrefix <prefix>",
    "Worker's name prefix. If the value is equals to 'hostname' the computer hostname will be used",
  )
  .action(execRunCommand);
