import { PathLike } from "fs";
import { FileHandle } from "fs/promises";
import { IO, Result } from "../index.js";

export interface IUtilsSatellite {
  /**
   * Read the contents of the given file.
   *
   * @param path
   */
  readFile(path: PathLike | FileHandle): IO<Promise<Result<Buffer, string>>>;

  /**
   * Get all files of a given extensions inside a directory and its subdirectories.
   *
   * @param dir Root directory to be searched.
   * @param extensions File extension filter. By default the filter is 'js' and 'mjs'.
   */
  recursiveDirSearch(dir: string, extensions: string | Array<string>): Array<string>;

  /**
   * Merge two hashes recursively.
   *
   * @param a First hash.
   * @param b Second hash.
   * @param args Additional arguments.
   */
  hashMerge<T>(a: object, b: object, args: T): Promise<object>;
}
