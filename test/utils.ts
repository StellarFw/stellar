import { join } from "path";

const pkg = require("../package.json");

export const buildEngineArgs = () => {
  return {
    rootPath: join(process.cwd(), "/example"),
    stellarPackageJSON: pkg,
    args: {},
  };
};
