import { Engine } from "@stellarfw/core";
import { join } from "path";

const buildEngineArgs = () => ({
	rootPath: join(process.cwd(), "/example"),
});

/**
 * Build a Stellar Engine instance and return it.
 */
export const buildEngine = () => new Engine(buildEngineArgs());
