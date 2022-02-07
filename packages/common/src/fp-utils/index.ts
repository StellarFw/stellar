import { writeFileSync } from "fs";
import { io, unsafeAsync } from "..";

export * from "./action-builder";

/**
 * Safely import a file using the JS `import` function.
 *
 * @param path path for the file to be imported
 * @returns io monad to contain the IO operation
 */
export const importFile = <T = unknown>(path: string) => io(() => unsafeAsync<T>(() => import(path)));

/**
 * Safely write contents to a file.
 */
export const safeWriteFile = (path: string, data: unknown) => io(() => writeFileSync(path, data));
