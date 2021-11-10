import { EngineStatus } from "..";

export interface API {
  /**
   * Unix time when the engine started.
   */
  bootTime: number;

  /**
   * Current engine status.
   */
  status: EngineStatus;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}
