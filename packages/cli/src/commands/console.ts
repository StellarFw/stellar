import { Engine } from "@stellarfw/core";
import { Command } from "commander";
import { start } from "repl";

const startRepl = (engine: Engine) => {
  const repl = start({
    prompt: `${engine.api.env}>`,
    input: process.stdin,
    output: process.stdout,
    useGlobal: false,
  });

  // put the API object into context
  repl.context.api = engine.api;

  // when the user exists REPL we must check if the Stella are stopped, otherwise we stop it first.
  repl.on("exit", async () => {
    if (engine.api.status !== "stopped") {
      await engine.stop();
      process.exit(0);
    }
  });
};

const startConsole = async (_str, args) => {
  // build and initialize Stellar, this will give us access to the config satellite
  const scope = { rootPath: process.cwd(), args };
  const engine = new Engine(scope);
  await engine.initialize();

  // disable all the servers
  for (const key in engine.api.configs.servers) {
    engine.api.configs.servers[key] = {
      ...engine.api.configs.servers[key],
      enable: false,
    };
  }

  // disable the task manager system
  engine.api.configs.tasks = {
    ...engine.api.configs.tasks,
    scheduler: false,
    queues: [],
    minTaskProcessors: 0,
    maxTaskProcessors: 0,
  };

  await engine.start();

  startRepl(engine);
};

export const consoleCommand = new Command("console")
  .description("Create a REPL connection with a Stellar instance")
  .action(startConsole);
