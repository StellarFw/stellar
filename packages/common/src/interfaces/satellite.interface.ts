/**
 * Interface for a Satellite, all Satellites must implement
 * this Interface.
 */
export interface SatelliteInterface {
  /**
   * Satellite name.
   *
   * Must of the times this will not be declared by developers. Stellar's Engine will set it for us.
   */
  name?: string;

  /**
   * Priority for defines when the Satellite must be loaded.
   */
  readonly loadPriority: number;

  /**
   * Priority that defines when the Satellite must be started.
   */
  readonly startPriority: number;

  /**
   * Priority that defines when the Satellite must be stopped.
   */
  readonly stopPriority: number;

  /**
   * Satellite loading function.
   *
   * This functions is responsible to load new logic into the Engine instance.
   *
   * @returns Returns a `Promise`.
   */
  load(): Promise<void>;

  /**
   * Satellite start function.
   *
   * This function is responsible to start any type of work  make by this Satellite. For example, this can be the start
   * of a Server listening.
   *
   * @returns Returns a `Promise`.
   */
  start?(): Promise<void>;

  /**
   * Satellite stop function.
   *
   * This function is responsible to stop any type of work that has been started by the Satellite.
   *
   * @returns Returns a `Promise`.
   */
  stop?(): Promise<void>;
}