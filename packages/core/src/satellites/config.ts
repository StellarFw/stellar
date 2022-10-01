import { EngineStatus, API, Satellite, LogLevel } from "@stellarfw/common";
import { normalize } from "path";
import { existsSync, watchFile, unwatchFile } from "fs";
import { stellarPkgPath } from "../engine";

class ConfigManager {
	private api!: API;

	/**
	 * Files to watch for changes.
	 */
	private watchedFiles: string[] = [];

	constructor(api) {
		this.api = api;
	}

	public async execute(): Promise<void> {
		this.setupEnvironment();
		await this.loadConfigs();
		await this.createTempFolder();
	}

	/**
	 * Setup the execution environment.
	 *
	 * This define what environment should be used.
	 */
	private setupEnvironment() {
		const args = this.api.scope.args;

		if (args.NODE_ENV) {
			this.api.env = args.NODE_ENV;
		} else if (process.env.NODE_ENV) {
			this.api.env = process.env.NODE_ENV;
		} else {
			this.api.env = "development";
		}
	}

	/**
	 * Creates the `temp` folder if it does not exits.
	 *
	 * This folder is used to store the log files.
	 */
	private async createTempFolder(): Promise<void> {
		const tempDirectory = this.api.configs.general.paths.temp;

		await this.api.utils
			.dirExists(tempDirectory)
			.map(async (resultP) => (await resultP) || this.api.utils.createDir(tempDirectory))
			.run();
	}

	private async loadConfigs() {
		const rootPath = this.api.scope.rootPath;

		this.api.configs = {};

		// file watching must keep disabled when it's running in stage0
		const isToWatch = this.api.status === EngineStatus.Stage0;

		// load manifest file into the API
		const manifestFileContainer = await this.api.utils
			.readFile(`${rootPath}/manifest.json`)
			.map(async (content) => (await content).map((val) => JSON.parse(val.toString())))
			.run();

		manifestFileContainer.tap({
			ok: (configs) => {
				this.api.configs = configs;
			},
			err: () => {
				this.api.log("Project 'manifest.json' file does not exists.", LogLevel.Emergency);
				process.exit(1);
			},
		});

		await this.loadConfigDirectory(`${stellarPkgPath}/config`, false);
		await Promise.all(
			this.api.configs.modules.map((module) =>
				this.loadConfigDirectory(`${rootPath}/modules/${module}/config`, isToWatch),
			),
		);

		await this.loadConfigDirectory(`${rootPath}/config`, isToWatch);
	}

	/**
	 * Load configurations from a directory.
	 *
	 * @param configPath Path of the directory where the configs must be loaded from.
	 * @param watch When `true` the engine reloads after a file change.
	 */
	private async loadConfigDirectory(configPath: string, _watch = false) {
		const configFiles: Array<string> = this.api.utils.recursiveDirSearch(configPath);
		let loadErrors = {};
		let loadRetries = 0;

		for (let index = 0, limit = configFiles.length; index < limit; index++) {
			const file = configFiles[index];

			try {
				const localConfig = await import(file);

				// load the base configurations that are independent from the environment that we are run in.
				if (localConfig.default) {
					this.api.configs = await this.api.utils.hashMerge(this.api.configs, localConfig.default, this.api);
				}

				// load configurations specific for the current environment
				if (localConfig[this.api.env]) {
					this.api.configs = await this.api.utils.hashMerge(this.api.configs, localConfig[this.api.env], this.api);
				}

				loadRetries = 0;
				loadErrors = {};

				// TODO: solve cache issue with ESModules. With ESM we don't have a standard way to invalidate cache, we need to find a hack.
				// if (watch) {
				//   this.watchFileAndAct(file, this.rebootCallback.bind(this));
				// }
			} catch (error) {
				// error loading configuration, abort if all remaining configuration
				// files have been tried and failed indicating inability to progress
				loadErrors[file] = error.toString();

				if (++loadRetries === limit - index) {
					throw new Error(`Unable to load configuration, errors: ${JSON.stringify(loadErrors)}`);
				}

				// adjust configuration files list: remove and push failed
				// configuration to the end of the list and continue with next
				// file at same index
				configFiles.push(configFiles.splice(index--, 1)[0]);
			}
		}
	}

	/**
	 * Start watching for changes on a file and set a function to be executed
	 * on the file change.
	 *
	 * TODO: move this into the API namespace.
	 *
	 * @param file File path.
	 * @param callback Callback function to be executed when the file changes.
	 */
	private watchFileAndAct(file, callback) {
		file = normalize(file);

		if (!existsSync(file)) {
			throw new Error(`${file} does not exist, and cannot be watched.`);
		}

		if (this.api.configs.general.developmentMode !== true || this.watchedFiles.includes(file)) {
			return;
		}

		this.watchedFiles.push(file);

		// Ask the file system to start watching for changes in the file
		// with an interval of 1 second
		watchFile(file, { interval: 1000 }, (curr, prev) => {
			if (curr.mtime <= prev.mtime || this.api.configs.general.developmentMode !== true) {
				return;
			}

			process.nextTick(() => {
				let cleanPath = file;
				if (process.platform === "win32") {
					cleanPath = file.replace(/\//g, "\\");
				}

				// clean the imported files cache to force the file reload
				delete require.cache[require.resolve(cleanPath)];

				callback(file);
			});
		});
	}

	/**
	 * Reboot handler.
	 *
	 * @param file Path for the file that as changed.
	 */
	private rebootCallback(file: string) {
		this.api.log(`\r\n\r\n*** rebooting due to config change (${file}) ***\r\n\r\n`, LogLevel.Info);
		delete require.cache[require.resolve(file)];
		this.api.commands.restart();
	}

	/**
	 * Unwatch all files.
	 *
	 * TODO: Move this into de API namespace.
	 */
	public unwatchAllFiles(): void {
		this.watchedFiles.forEach((file) => unwatchFile(file));
		this.watchedFiles = [];
	}
}

export default class ConfigSatellite extends Satellite {
	public loadPriority = 0;
	protected _name = "config";

	public async load(): Promise<void> {
		this.api.config = new ConfigManager(this.api);
		await this.api.config.execute();
	}

	public async start(): Promise<void> {
		this.api.log(`Environment: ${this.api.env}`, LogLevel.Notice);
	}

	public async stop(): Promise<void> {
		this.api.config.unwatchAllFiles();
	}
}
