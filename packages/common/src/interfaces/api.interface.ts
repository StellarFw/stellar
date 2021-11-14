import { EngineStatus } from "..";
import { ICacheSatellite } from "./cache-satellite.interface";

export interface API {
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
   */
  cache: ICacheSatellite;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}
