import { existsSync, PathLike, readFileSync } from "fs";
import { mkdir } from "fs/promises";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

/**
 * CLI dir path.
 */
export const cliPath = dirname(fileURLToPath(import.meta.url));

/**
 * Stellar package.json content.
 */
export const pkgMetadata = JSON.parse(readFileSync(resolve(cliPath, "../package.json")).toString());

/**
 * Check if the given process id is running.
 */
export const isPidRunning = (pid: number): boolean => {
	try {
		return process.kill(pid, 0);
	} catch (e) {
		return e.code === "EPERM";
	}
};

/**
 * Create a directory if it doesn't exists.
 */
export const createDirectory = async (path: PathLike) => {
	if (!existsSync(path)) {
		return mkdir(path);
	}
};
