import { readFileSync } from "fs";
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
