import { Result } from "..";

export interface IModuleSatellite {
	/**
	 * Register a new action name for a module.
	 *
	 * @param moduleName Module name.
	 * @param value Array of actions name to be stores.
	 */
	regModuleAction(moduleName: string, value: string | Array<string>): Result<true, string>;
}
