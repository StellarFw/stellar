import { IActionSatellite, ICacheSatellite, IValidatorSatellite, IHelpersSatellite, IModuleSatellite } from ".";
import { EngineStatus, LogLevel } from "..";
import { IEventsSatellite } from "./events.interface";
import { IHashSatellite } from "./hash-satellite.interface";
import { IUtilsSatellite } from "./utils.interface";

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
	 * Event system to hook into the execution of actions and core features.
	 */
	events: IEventsSatellite;

	/**
	 * Exposes some hash features using bcrypt algorithm.
	 */
	hash: IHashSatellite;

	/**
	 * Utility functions that are used by both core and application.
	 */
	utils: IUtilsSatellite;

	/**
	 * Helper functions for some recurrent tasks inside the core.
	 *
	 * IMPORTANT: this is for internal use only.
	 */
	helpers: IHelpersSatellite;

	/**
	 * Runtime configurations.
	 */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	configs: { [key: string]: any };

	modules: IModuleSatellite;

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	[key: string]: any;
}
