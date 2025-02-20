import { IActionSatellite } from "./actions-satellite.types.ts";
import { Configs } from "./configs/configs.types.ts";
import { IStaticFile } from "./static-file.interface.ts";

/**
 * Global API object.
 */
export type API = {
	/**
	 * Unix time when the engine started.
	 */
	bootTime?: number;

	scope: { rootPath: string };

	/**
	 * Runtime configurations.
	 */
	config: Configs;

	/**
	 * Used to work with static files.
	 */
	staticFile: IStaticFile;

	/**
	 * Manages Stellar actions.
	 */
	actions: IActionSatellite;

	// this is for other things that modules can add to
	[key: string]: unknown;
};
