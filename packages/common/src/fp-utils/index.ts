import { PathLike, writeFileSync } from "fs";
import { FileHandle, readFile } from "fs/promises";
import { io, unsafeAsync } from "../index.js";

export * from "./action-builder.js";

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
export const safeWriteFile = (path: string, data: string | NodeJS.ArrayBufferView) =>
  io(() => writeFileSync(path, data));

/**
 * Read the content of a file.
 *
 * @param path file to be read.
 * @returns
 */
export const safeReadFile = (path: PathLike | FileHandle) => io(() => unsafeAsync(() => readFile(path)));
