import { Satellite, IO, io, safeReadFile, Result, pipe, unsafeAsync } from "@stellarfw/common";
import { setTimeout } from "timers";
import {
	readdirSync,
	statSync,
	existsSync,
	readlinkSync,
	createReadStream,
	createWriteStream,
	accessSync,
	PathLike,
	Stats,
	constants,
} from "fs";
import { normalize, join } from "path";
import { networkInterfaces } from "os";
import { FileHandle, mkdir, readdir, rm, stat } from "fs/promises";

class Utils {
	private api: any = null;

	constructor(api) {
		this.api = api;
	}

	/**
	 * A Promise abstraction for the setTimeout function.
	 *
	 * This helper method is interesting when it's necessary waiting for a
	 * period of time to execute something, and there is no other work to
	 * preform until that time doesn't pass.
	 *
	 * @param time Period of time to wait for until the Promise isn't
	 * resolved.
	 */
	public delay(time: number): Promise<void> {
		return new Promise((resolve) => {
			setTimeout(resolve, time);
		});
	}

	public listFiles(path: PathLike): IO<Promise<Array<string>>> {
		const getNodeStat = pipe<string, [string, Stats]>(
			(fileName) => join(path.toString(), fileName),
			async (path) => [path, await stat(path)],
		);

		return io(async () => {
			const nodes = await readdir(path)
				.then((v) => v.map(getNodeStat))
				.then((v) => Promise.all(v));

			return nodes.filter(([_, s]) => !s.isDirectory()).map((v) => v[0]);
		});
	}

	/**
	 * Get all files of a given extensions inside a directory and its subdirectories.
	 *
	 * @param dir Root directory to be searched.
	 * @param extensions File extension filter. By default the filter is
	 * 'js.
	 */
	public recursiveDirSearch(
		dir: string,
		extensions: string | Array<string> = ["js", "mjs", "ts", "mts"],
	): Array<string> {
		let results: Array<string> = [];

		const innerExtensions = Array.isArray(extensions) ? extensions : [extensions];

		// Remove dots from the extensions
		innerExtensions.forEach((ext) => ext.replace(".", ""));

		if (dir[dir.length - 1] !== "/") {
			dir += "/";
		}

		if (!existsSync(dir)) {
			return results;
		}

		readdirSync(dir).forEach((file) => {
			const fullFilePath = normalize(dir + file);

			// ignore hidden files
			if (file[0] === ".") {
				return;
			}

			const stats = statSync(fullFilePath);

			if (stats.isDirectory()) {
				const child = this.recursiveDirSearch(fullFilePath, innerExtensions);
				results = results.concat(child);
			} else if (stats.isSymbolicLink()) {
				const realPath = readlinkSync(fullFilePath);
				const child = this.recursiveDirSearch(fullFilePath, innerExtensions);
				results = results.concat(child);
			} else if (stats.isFile()) {
				const fileParts = file.split(".");
				const ext = fileParts[fileParts.length - 1];
				if (innerExtensions.includes(ext)) {
					results.push(fullFilePath);
				}
			}
		});

		return results.sort();
	}

	/**
	 * Create a new directory.
	 *
	 * @param path Path where the directory must be created.
	 */
	public createDir(path: PathLike, mode = 0o777): IO<Promise<Result<string | undefined>>> {
		return io(() => unsafeAsync(() => mkdir(path, { mode, recursive: true })));
	}

	/**
	 * Remove a file/directory.
	 *
	 * @param path Path to be removed.
	 */
	public removePath(path: PathLike): IO<Promise<Result<void>>> {
		return io(() => unsafeAsync(() => rm(path)));
	}

	/**
	 * Check if the directory exists.
	 *
	 * @param path Path of the directory to be tested
	 */
	public dirExists(path: PathLike): IO<Promise<boolean>> {
		return io(async () => {
			return (await unsafeAsync(() => stat(path))).match({
				err() {
					return false;
				},
				ok(stats) {
					return stats.isDirectory();
				},
			});
		});
	}

	/**
	 * Check if a file exists.
	 *
	 * @param dir Path to check.
	 */
	fileExists(path: PathLike): IO<Promise<boolean>> {
		return io(async () =>
			(await unsafeAsync(() => stat(path))).match({
				err() {
					return false;
				},
				ok(stats) {
					return stats.isFile();
				},
			}),
		);
	}

	/**
	 * Read the given file contents.
	 *
	 * @param path
	 * @returns
	 */
	public readFile(path: PathLike | FileHandle): IO<Promise<Result<Buffer, string>>> {
		return safeReadFile(path);
	}

	public readJsonFile<T>(path: PathLike | FileHandle): IO<Promise<Result<T, string>>> {
		return safeReadFile(path).map((future) =>
			future.then((result) => result.map((buffer) => JSON.parse(buffer.toString()))),
		);
	}

	/**
	 * Copy a file.
	 *
	 * @param source Source path.
	 * @param destination Destination path.
	 */
	public copyFile(source: string, destination: string): void {
		createReadStream(source).pipe(createWriteStream(destination));
	}

	/**
	 * Check if a file/folder exists.
	 *
	 * @param path Path to check if exists.
	 */
	public exists(path: string): boolean {
		try {
			accessSync(path, constants.F_OK);
		} catch (_) {
			return false;
		}

		return true;
	}

	/**
	 * Check if the passed argument is a plain object.
	 *
	 * @param o Object to be tested.
	 */
	public isPlainObject(o: any = false): boolean {
		const safeTypes = [Boolean, Number, String, Function, Array, Date, RegExp, Buffer];
		const safeInstances = ["boolean", "number", "string", "function"];
		const expandPreventMatchKey = "_toExpand";

		if (o instanceof Object === false) {
			return false;
		}

		for (const type of safeTypes) {
			if (o instanceof type) {
				return false;
			}
		}

		for (const inst of safeInstances) {
			if (typeof o === inst) {
				return false;
			}
		}

		if (o[expandPreventMatchKey] === false) {
			return false;
		}

		return o.toString() === "[object Object]";
	}

	/**
	 * Merge two hashes recursively.
	 *
	 * @param a First hash.
	 * @param b Second hash.
	 * @param args Additional arguments.
	 */
	public async hashMerge<T>(a: object, b: object, args: T): Promise<object> {
		const c = {};
		let response;

		for (const i in a) {
			if (this.isPlainObject(a[i]) && Object.keys(a[i]).length > 0) {
				c[i] = await this.hashMerge(c[i], a[i], args);
			} else {
				if (typeof a[i] === "function") {
					response = await a[i](args);

					if (this.isPlainObject(response)) {
						c[i] = await this.hashMerge(c[i], response, args);
					} else {
						c[i] = response;
					}
				} else {
					c[i] = a[i];
				}
			}
		}

		for (const i in b) {
			if (this.isPlainObject(b[i]) && Object.keys(b[i]).length > 0) {
				c[i] = await this.hashMerge(c[i], b[i], args);
			} else {
				if (typeof b[i] === "function") {
					response = await b[i](args);

					if (this.isPlainObject(response)) {
						c[i] = await this.hashMerge(c[i], response, args);
					} else {
						c[i] = response;
					}
				} else {
					c[i] = b[i];
				}
			}
		}

		return c;
	}

	/**
	 * Get this server external interface.
	 */
	public getExternalIPAddress(): string | boolean {
		const ifaces = networkInterfaces();
		let ip: boolean | string = false;

		Object.keys(ifaces).forEach((dev) => {
			ifaces[dev]?.forEach((details) => {
				if (details.family === "IPv4" && details.address !== "127.0.0.1") {
					ip = details.address;
				}
			});
		});

		return ip;
	}

	/**
	 * Custom require function to load from the core scope and then from the
	 * project scope.
	 *
	 * @note: this is a ugly hack but it works!
	 */
	public require(path: string): any {
		// Try load the module from the core.
		try {
			return require(path);
		} catch (e) {
			if (this.api == null) {
				throw e;
			}

			// If it fails, try load from the project folder.
			try {
				return require(`${this.api.scope.rootPath}/node_modules/${path}`);
			} catch (e) {
				throw e;
			}
		}
	}

	/**
	 * Get an object property that resides on the given path.
	 *
	 * @param object Object.
	 * @param path Path to a property that is part of the API object.
	 */
	public stringToHash(object: any, path: string): any {
		return path.split(".").reduce((obj, i) => obj[i], object);
	}

	/**
	 * Checks if the given var is an non empty string.
	 *
	 * @param value Value to be validated.
	 */
	public isNonEmptyString(value: string): boolean {
		return value.length > 0;
	}

	/**
	 * Convert snake case string to camel case.
	 *
	 * @param {string} s String to be converted.
	 */
	public snakeToCamel(s) {
		return s.replace(/(\_\w)/g, (m) => m[1].toUpperCase());
	}

	/**
	 * Unique-ify an array.
	 *
	 * @param array Array to be uniquefied.
	 * @returns {Array} New array.
	 */
	public arrayUniqueify(array) {
		array.filter((value, index, self) => {
			return self.indexOf(value) === index;
		});

		return array;
	}

	/**
	 * Execute the given command.
	 *
	 * @param command Command to be executed
	 * @param args Command arguments
	 * @param context Method context
	 */
	public executeCommand(command: string, args: Array<any>, context: any) {
		const hasContext = !!context;
		const commandParts = command.split(".");
		let method = this.api;

		// Get the method reference
		commandParts.forEach((identifier) => {
			if (!hasContext) {
				context = method;
			}

			method = method[identifier];
		});

		// Execute the method
		return method.apply(context, args);
	}

	/**
	 * Cookie parse from headers of http(s) requests.
	 *
	 * @param req
	 * @returns {{}}
	 */
	public parseCookies(req) {
		const cookies = {};
		if (req.headers.cookie) {
			req.headers.cookie.split(";").forEach((cookie) => {
				const parts = cookie.split("=");
				cookies[parts[0].trim()] = (parts[1] || "").trim();
			});
		}
		return cookies;
	}

	/**
	 * Collapse this object to an array.
	 *
	 * @param obj
	 * @returns {*}
	 */
	public collapseObjectToArray(obj: { [key: string]: any }): Array<any> | boolean {
		try {
			const keys = Object.keys(obj);
			if (keys.length < 1) {
				return false;
			}
			if (keys[0] !== "0") {
				return false;
			}
			if (keys[keys.length - 1] !== String(keys.length - 1)) {
				return false;
			}

			const arr: Array<any> = [];
			for (const i in keys) {
				if (!keys.hasOwnProperty(i)) {
					continue;
				}

				const key = keys[i];
				if (String(parseInt(key, 10)) !== key) {
					return false;
				} else {
					arr.push(obj[key]);
				}
			}

			return arr;
		} catch (e) {
			return false;
		}
	}

	/**
	 * Check if the given var is an object.
	 *
	 * @param arg Var to test.
	 */
	public isObject(arg: any): boolean {
		return typeof arg === "object" && arg !== null;
	}

	/**
	 * Convert an object to string.
	 *
	 * @param o Object to be converted.
	 */
	public objectToString(o: object): string {
		return Object.prototype.toString.call(o);
	}

	/**
	 * Check if the given argument is an Error.
	 *
	 * @param e Possible error object.
	 */
	public isError(e: any) {
		return this.isObject(e) && (this.objectToString(e) === "[object Error]" || e instanceof Error);
	}
}

export default class UtilsSatellite extends Satellite {
	public loadPriority = 0;
	protected _name = "Utils";

	public async load(): Promise<void> {
		this.api.utils = new Utils(this.api);
	}
}
