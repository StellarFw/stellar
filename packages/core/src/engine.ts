/* eslint-disable @typescript-eslint/ban-ts-comment */
import "source-map-support/register";
import "reflect-metadata";

import { resolve, normalize, basename } from "path";

// @ts-ignore
import stellarPackageJSON from "../package.json";

import { SatelliteInterface } from "@stellarfw/common/lib/interfaces/satellite.interface";
import { Satellite } from "@stellarfw/common/lib";
import { EngineStatus } from "@stellarfw/common/lib/enums/engine-status.enum";
import { LogLevel } from "@stellarfw/common/lib/enums/log-level.enum";

/**
 * Main entry point for the Stellar code.
 *
 * This makes the system bootstrap, loading and executing all satellites.
 * Each satellite load new features to the Engine instance and could perform
 * a set of instructions to accomplish a certain goal.
 */
export class Engine {
  /**
   * List of all loaded Satellites.
   */
  private satellites: Map<string, SatelliteInterface> = new Map();

  private satellitesLoadOrder: Map<number, Array<SatelliteInterface>> = new Map();
  private satellitesStartOrder: Map<number, Array<SatelliteInterface>> = new Map();
  private satellitesStopOrder: Map<number, Array<SatelliteInterface>> = new Map();

  private loadSatellites: Array<SatelliteInterface> = [];
  private startSatellites: Array<SatelliteInterface> = [];
  private stopSatellites: Array<SatelliteInterface> = [];

  private startCount = 0;

  /**
   * API object.
   *
   * This object contains all the logic shared across all platform. It's here
   * Satellites will load logic and developers access the functions.
   */
  public api: any = {
    bootTime: null,
    status: EngineStatus.Stopped,
    log: null,
    scope: {},
  };

  constructor(scope) {
    this.api = {
      ...this.api,
      log: this.log,
      scope,
      commands: {
        start: this.start.bind(this),
        stop: this.stop.bind(this),
        restart: this.restart.bind(this),
      },
    };

    this.api.scope = {
      ...this.api.scope,
      args: scope.args ?? {},
      stellarPackageJSON,
    };
  }

  private log(msg: unknown, level: LogLevel = LogLevel.Info) {
    // when it's running on a test environment the logs are disabled
    if (process.env.NODE_ENV === "test") {
      return;
    }

    switch (level) {
      case LogLevel.Emergency || LogLevel.Error:
        console.log(`\x1b[31m[-] ${msg}\x1b[37m`);
        break;
      case LogLevel.Info:
        console.log("[!]", msg);
        break;
    }
  }

  /**
   * Print fatal error on the console and finishes the process.
   *
   * @param errors String or array with the fatal error(s).
   * @param type Error type.
   */
  private async fatalError(errors: Array<Error> | Error, type: string) {
    if (!errors) {
      throw new Error("There must be passed at lest one Error");
    }
    if (!Array.isArray(errors)) {
      errors = [errors];
    }

    this.log(`Error with satellite step: ${type}`, LogLevel.Emergency);
    errors.forEach((error) => console.error(error));

    // stop process execution
    await this.stop();

    // When running in test mode the process shouldn't be
    // killed
    if (process.env.NODE_ENV !== "test") {
      process.exit(1);
    }
  }

  /**
   * Function to load the satellites in the right place given they priorities.
   *
   * @param satellitesFiles Array of paths.
   */
  private loadArrayOfSatellites(satellitesFiles): void {
    for (const path of satellitesFiles) {
      const file = normalize(path);
      const satelliteName = basename(file).split(".")[0];
      const extension = file.split(".").pop();

      // only load files with the `js` extension
      if (extension !== "js") {
        continue;
      }

      const SatelliteClass = require(file).default;
      const satelliteInstance: SatelliteInterface = new SatelliteClass(this.api);

      this.satellites[satelliteName] = satelliteInstance;

      if (typeof satelliteInstance.load === "function") {
        this.satellitesLoadOrder[satelliteInstance.loadPriority] =
          this.satellitesLoadOrder[satelliteInstance.loadPriority] || [];
        this.satellitesLoadOrder[satelliteInstance.loadPriority].push(satelliteInstance);
      }

      if (typeof satelliteInstance.start === "function") {
        this.satellitesStartOrder[satelliteInstance.startPriority] =
          this.satellitesStartOrder[satelliteInstance.startPriority] || [];
        this.satellitesStartOrder[satelliteInstance.startPriority].push(satelliteInstance);
      }

      if (typeof satelliteInstance.stop === "function") {
        this.satellitesStopOrder[satelliteInstance.stopPriority] =
          this.satellitesStopOrder[satelliteInstance.stopPriority] || [];
        this.satellitesStopOrder[satelliteInstance.stopPriority].push(satelliteInstance);
      }
    }
  }

  /**
   * Order a collection of satellites by their priority.
   *
   * @param collection Collection of satellites to be ordered.
   */
  private flattenOrderedSatellites(collection) {
    const output: Array<Satellite> = [];

    Object.keys(collection)
      .map((k) => parseInt(k, 10))
      .sort((a, b) => a - b)
      .forEach((k) => collection[k].forEach((d: Satellite) => output.push(d)));

    return output;
  }

  /**
   * Second startup stage.
   *
   * Steps:
   *  - load all satellites into memory;
   *  - load satellites;
   *  - mark Engine like initialized;
   */
  private async stage1(): Promise<void> {
    this.api.status = EngineStatus.Stage1;

    this.satellitesLoadOrder = new Map();
    this.satellitesStartOrder = new Map();
    this.satellitesStopOrder = new Map();

    // load the core satellites
    this.loadArrayOfSatellites(this.api.utils.getFiles(`${__dirname}/satellites`));

    // load module satellites
    const modulesToLoad = this.api.configs.modules || [];
    modulesToLoad.forEach((moduleName) => {
      const moduleSatellitesPath = `${this.api.scope.rootPath}/modules/${moduleName}/satellites`;
      if (this.api.utils.dirExists(moduleSatellitesPath)) {
        this.loadArrayOfSatellites(this.api.utils.getFiles(moduleSatellitesPath));
      }
    });

    // organize final array to match the satellites priorities
    this.loadSatellites = this.flattenOrderedSatellites(this.satellitesLoadOrder);
    this.startSatellites = this.flattenOrderedSatellites(this.satellitesStartOrder);
    this.stopSatellites = this.flattenOrderedSatellites(this.satellitesStopOrder);

    try {
      for (const satelliteInstance of this.loadSatellites) {
        this.api.log(`> load: ${satelliteInstance.name}`, LogLevel.Debug);
        await satelliteInstance.load();
        this.api.log(`\tloaded: ${satelliteInstance.name}`, LogLevel.Debug);
      }
    } catch (e) {
      this.fatalError(e, "stage1");
    }
  }

  private async stage2(): Promise<void> {
    try {
      for (const satelliteInstance of this.startSatellites) {
        this.api.log(`> start: ${satelliteInstance.name!}`, LogLevel.Debug);
        await satelliteInstance.start!();
        this.api.log(`\tstarted: ${satelliteInstance.name!}`, LogLevel.Debug);
      }
    } catch (error) {
      this.fatalError(error, "stage2");
    }

    this.api.status = EngineStatus.Running;
    this.api.bootTime = new Date().getTime();

    if (this.startCount === 0) {
      this.api.log(`** Server Started @ ${new Date()} **`, LogLevel.Alert);
    } else {
      this.api.log(`** Server Restarted @ ${new Date()} **`, LogLevel.Alert);
    }

    this.startCount++;
  }

  /**
   * First startup stage.
   *
   * This step is responsible to execute the initial
   * Satellites.
   */
  public async initialize(): Promise<Engine> {
    if (this.api.status !== EngineStatus.Stopped) {
      throw new Error("Invalid Engine state, it must be stopped first.");
    }

    this.satellites = new Map();

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
      const fileName = file.replace(/^.*[\\\/]/, "");
      const satellite = fileName.split(".")[0];

      const currentSatellite = new (require(file).default)(this.api);
      this.satellites[satellite] = currentSatellite;

      try {
        await currentSatellite.load();
      } catch (error) {
        this.fatalError(error, "stage0");
      }
    }

    return this;
  }

  public async start(): Promise<Engine> {
    // when the Engine isn't initialized just do it now. This usually happens with tests.
    if (this.api.status !== EngineStatus.Stage0) {
      await this.initialize();
    }

    this.startCount = 0;
    await this.stage1();
    await this.stage2();

    return this;
  }

  /**
   * Restarts the engine.
   *
   * This execute the stop action and executed the stage2 again.
   */
  public async restart(): Promise<Engine> {
    if (this.api.status === EngineStatus.Running) {
      await this.stop();
    }

    await this.stage2();

    this.api.log("** Stellar Restarted **", LogLevel.Info);

    return this;
  }

  /**
   * Stop the engine.
   *
   * Tries to shutdown the engine in a non violent way. This starts
   * executes all the stop methods provided by the loaded Satellites.
   */
  public async stop(): Promise<Engine> {
    if (this.api.status === EngineStatus.Stopping) {
      // double sigterm; ignore it
      return this;
    }

    if (this.api.status === EngineStatus.Running) {
      this.api.status = EngineStatus.Stopping;
      this.api.log("Shutdown down open server and stopping task processing", LogLevel.Alert);

      try {
        for (const satelliteInstance of this.stopSatellites) {
          this.api.log(`> stop: ${satelliteInstance.name!}`, LogLevel.Debug);
          await satelliteInstance.stop!();
          this.api.log(`\tstopped: ${satelliteInstance.name!}`, LogLevel.Debug);
        }
      } catch (error) {
        this.fatalError(error, "stop");
      }

      this.api.config.unwatchAllFiles();

      // TODO: this.api.pids.clearPidFile();

      this.api.log("Stellar has been stopped", LogLevel.Alert);
      this.api.log("**", LogLevel.Debug);

      this.api.status = EngineStatus.Stopped;

      return this;
    }

    this.api.log("Cannot shutdown Stellar, not running", LogLevel.Error);

    return this;
  }
}

export default Engine;
