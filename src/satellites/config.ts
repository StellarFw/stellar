import { Satellite } from "../satellite";
import { EngineStatus } from "../engine-status.enum";
import { LogLevel } from "../log-level.enum";
import { normalize } from "path";
import { existsSync, watchFile, unwatchFile } from "fs";

class ConfigManager {
  private api: any = null;

  /**
   * Files to watch for changes.
   */
  private watchedFiles: string[] = [];

  constructor(api) {
    this.api = api;
  }

  public async execute(): Promise<void> {
    this.setupEnvironment();
    this.loadConfigs();
    this.createTempFolder();
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
  private createTempFolder() {
    const tempDirectory = this.api.configs.general.paths.temp;

    if (!this.api.utils.dirExists(tempDirectory)) {
      this.api.utils.createDir(tempDirectory);
    }
  }

  private loadConfigs() {
    const rootPath = this.api.scope.rootPath;

    this.api.configs = {};

    // file watching must keep disabled when it's running in stage0
    const isToWatch = this.api.status === EngineStatus.Stage0;

    // load manifest file into the API
    try {
      this.api.configs = require(`${rootPath}/manifest.json`);
    } catch (e) {
      this.api.log(
        `Project 'manifest.json' file does not exists.`,
        LogLevel.Emergency,
      );
      process.exit(1);
    }

    this.loadConfigDirectory(`${__dirname}/../config`, false);
    this.api.configs.modules.forEach(module =>
      this.loadConfigDirectory(
        `${rootPath}/modules/${module}/config`,
        isToWatch,
      ),
    );
    this.loadConfigDirectory(`${rootPath}/config`, isToWatch);
  }

  /**
   * Load configurations from a directory.
   *
   * @param configPath Path of the directory where the configs must be loaded from.
   * @param watch When `true` the engine reloads after a file change.
   */
  private loadConfigDirectory(configPath: string, watch: boolean = false) {
    const configFiles: Array<string> = this.api.utils.recursiveDirSearch(
      configPath,
    );
    let loadErrors = {};
    let loadRetries = 0;

    for (let index = 0, limit = configFiles.length; index < limit; index++) {
      const file = configFiles[index];

      try {
        const localConfig = require(file);
        // Load general configurations
        if (localConfig.default) {
          this.api.configs = this.api.utils.hashMerge(
            this.api.configs,
            localConfig.default,
            this.api,
          );
        }

        // load configurations specific for the current environment
        if (localConfig[this.api.env]) {
          this.api.configs = this.api.utils.hashMerge(
            this.api.configs,
            localConfig[this.api.env],
            this.api,
          );
        }

        loadRetries = 0;
        loadErrors = {};

        if (watch) {
          this.watchFileAndAct(file, this.rebootCallback.bind(this));
        }
      } catch (error) {
        // error loading configuration, abort if all remaining configuration
        // files have been tried and failed indicating inability to progress
        loadErrors[file] = error.toString();

        if (++loadRetries === limit - index) {
          throw new Error(
            `Unable to load configuration, errors: ${JSON.stringify(
              loadErrors,
            )}`,
          );
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

    if (
      this.api.configs.general.developmentMode !== true ||
      this.watchedFiles.includes(file)
    ) {
      return;
    }

    this.watchedFiles.push(file);

    // Ask the file system to start watching for changes in the file
    // with an interval of 1 second
    watchFile(file, { interval: 1000 }, (curr, prev) => {
      if (
        curr.mtime <= prev.mtime ||
        this.api.configs.general.developmentMode !== true
      ) {
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
    this.api.log(
      `\r\n\r\n*** rebooting due to config change (${file}) ***\r\n\r\n`,
      LogLevel.Info,
    );
    delete require.cache[require.resolve(file)];
    this.api.commands.restart();
  }

  /**
   * Unwatch all files.
   *
   * TODO: Move this into de API namespace.
   */
  public unwatchAllFiles(): void {
    this.watchedFiles.forEach(file => unwatchFile(file));
    this.watchedFiles = [];
  }
}

export default class ConfigSatellite extends Satellite {
  public loadPriority: number = 0;
  protected _name: string = "Config";

  public async load(): Promise<void> {
    this.api.config = new ConfigManager(this.api);
    this.api.config.execute();
  }

  public async start(): Promise<void> {
    this.api.log(`Environment: ${this.api.env}`, LogLevel.Notice);
  }

  public async stop(): Promise<void> {
    this.api.config.unwatchAllFiles();
  }
}
