import { PathLike } from "fs";
import { FileHandle } from "fs/promises";
import { IO, Result } from "../index";

export interface IUtilsSatellite {
	/**
	 * Read all files from the given directory.
	 *
	 * @param path Path to the directory to be.
	 */
	listFiles(path: PathLike): IO<Promise<Array<string>>>;

	/**
	 * Read the contents of the given file.
	 *
	 * @param path
	 */
	readFile(path: PathLike | FileHandle): IO<Promise<Result<Buffer, string>>>;

	/**
	 * Read a JSON file from the filesystem.
	 *
	 * @param path path for the JSON file to be read.
	 */
	readJsonFile<T>(path: PathLike | FileHandle): IO<Promise<Result<T, string>>>;

	/**
	 * Get all files of a given extensions inside a directory and its subdirectories.
	 *
	 * @param dir Root directory to be searched.
	 * @param extensions File extension filter. By default the filter is 'js' and 'mjs'.
	 */
	recursiveDirSearch(dir: string, extensions: string | Array<string>): Array<string>;

	/**
	 * Check if the directory exists.
	 *
	 * @param path Path of the directory to be tested
	 */
	dirExists(path: PathLike): IO<Promise<boolean>>;

	/**
	 * Create a new directory.
	 *
	 * @param path Path where the directory must be created.
	 */
	createDir(path: PathLike, mode?: number): IO<Promise<Result<string | undefined>>>;

	/**
	 * Remove a directory.
	 *
	 * @param path Directory to be removed.
	 */
	removeDir(path: PathLike): IO<Promise<void>>;

	/**
	 * Merge two hashes recursively.
	 *
	 * @param a First hash.
	 * @param b Second hash.
	 * @param args Additional arguments.
	 */
	hashMerge<T>(a: object, b: object, args: T): Promise<object>;
}
