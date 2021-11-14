import { writeFileSync } from "fs";
import { io, unsafe } from "..";

/**
 * Safely require a file using the node.js `require` function.
 *
 * @param path path for the file to be imported
 * @returns io monad to contain the IO operation
 */
export const requireFile = (path: string) => io(() => unsafe(() => require(path)));

/**
 * Safely write contents to a file.
 */
export const safeWriteFile = (path: string, data: unknown) => io(() => writeFileSync(path, data));
