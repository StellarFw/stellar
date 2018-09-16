import Engine from "../lib/engine";
import { join } from "path";

const pkg = require("../package.json");

export const buildEngineArgs = () => {
  return {
    rootPath: join(process.cwd(), "/example"),
    stellarPackageJSON: pkg,
    args: {},
  };
};

export const startEngine = async () => {
  const engine = new Engine(buildEngineArgs());
  await engine.initialize();
  await engine.start();

  return engine;
};
