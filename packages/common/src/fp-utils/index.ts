import { writeFileSync } from "fs";
import { io, unsafe } from "..";

export * from "./action-builder";

/**
 * Safely import a file using the JS `import` function.
 *
 * @param path path for the file to be imported
 * @returns io monad to contain the IO operation
 */
export const importFile = (path: string) => io(() => unsafe(() => import(path)));

/**
 * Safely write contents to a file.
 */
export const safeWriteFile = (path: string, data: unknown) => io(() => writeFileSync(path, data));
