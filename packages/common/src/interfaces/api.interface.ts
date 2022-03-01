import { IActionSatellite, ICacheSatellite, IValidatorSatellite } from ".";
import { EngineStatus, LogLevel } from "..";
import { IUtilsSatellite } from "./utils.interface.js";

export interface API {
  /**
   * Log a message.
   */
  log: (msg: string, level: LogLevel, ...extra: Array<unknown>) => void;

  /**
   * Unix time when the engine started.
   */
  bootTime: number;

  /**
   * Current engine status.
   */
  status: EngineStatus;

  /**
   * Cache satellite.
   *
   * Methods too cache data on a Redis like system.
   */
  cache: ICacheSatellite;

  /**
   * Validator satellite.
   *
   * Useful tools to validate data and get comprehensive errors out from it.
   */
  validator: IValidatorSatellite;

  /**
   * Action satellite.
   *
   * Allows to manage middleware and actions in the system, as well to call them.
   */
  actions: IActionSatellite;

  /**
   * Utility functions that are used by both core and application.
   */
  utils: IUtilsSatellite;

  /**
   * Runtime configurations.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  configs: { [key: string]: any };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}
