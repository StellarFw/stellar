import { resolve } from 'path';
import { SatelliteInterface } from './satellite.interface';
import { Satellite } from './satellite';
import { EngineStatus } from './engine-status.enum';
import { LogLevel } from './log-level.enum';

/**
 * Main entry point for the Stellar code.
 * 
 * This makes the system bootstrap, loading and executing all satellites.
 * Each satellite load new features to the Engine instance and could perform
 * a set of instructions to accomplish a certain goal.
 */
export default class Engine {
  /**
   * List of all loaded Satellites.
   */
  private satellites: SatelliteInterface[] = []

  /**
   * API object.
   * 
   * This object contains all the logic shared across all platform. It's here
   * Satellites will load logic and developers access the functions.
   */
  private api: any = {
    bootTime: null,
    status: EngineStatus.Stopped,
    log: null,
    scope: {}
  }

  constructor(scope) {
    this.api = {
      ...this.api,
      log: this.log,
      scope,
    };

    this.api.scope = {
      ...this.api.scope,
      args: scope.args,
    };
  }

  private log(msg: any, level: LogLevel = LogLevel.Info) {
    // when it's running on a test environment the logs are disabled
    if (process.env.NODE_ENV === 'test') { return; }

    switch (level) {
      case LogLevel.Emergency || LogLevel.Error:
        console.log(`\x1b[31m[-] ${msg}\x1b[37m`);
        break;
      case LogLevel.Info:
        console.log(`[!] ${msg}`);
        break;
    }
  }

  private fatalError(errors: Array<Error> | Error, type: string) {
    if (!errors) { throw new Error('There must be passed at lest one Error'); }
    if (!Array.isArray(errors)) { errors = [errors]; }

    this.log(`Error with satellite step: ${type}`, LogLevel.Emergency);
    errors.forEach(error => this.api(error, LogLevel.Emergency));

    // TODO: stop process execution
  }

  /**
   * First startup stage.
   *
   * This step is responsible to execute the initial
   * Satellites.
   */
  public async initialize(): Promise<Engine> {
    const satellitesToLoad: SatelliteInterface[] = [];

    this.log(`Current universe "${this.api.scope.rootPath}"`, LogLevel.Info);
    this.api.status = EngineStatus.Stage0;

    // the `utils` and `config` Satellites needs to be loaded
    // first. They contains some functions that are needed
    // durning the startup process.
    const initialSatellites = [
      resolve(`${__dirname}/satellites/utils.js`),
      resolve(`${__dirname}/satellites/config.js`),
    ];

    for (const file of initialSatellites) {
      const fileName = file.replace(/^.*[\\\/]/, '');
      const satellite = fileName.split('.')[0];

      const currentSatellite = new (require(file).default)(this.api);
      this.satellites[satellite] = currentSatellite;

      try {
        await currentSatellite.load();
      } catch (error) {
        this.fatalError(error, 'stage0');
      }
    }

    return this;
  }
}
