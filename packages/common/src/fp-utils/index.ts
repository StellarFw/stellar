import { io } from "..";

/**
 * Safely require a file using the node.js `require` function.
 *
 * @param path path for the file to be imported
 * @returns io monad to contain the IO operation
 */
export const requireFile = (path: string) => io(() => require(path));
