import { ModuleInterface, Result } from "..";

export interface IModuleSatellite {
	/**
	 * Map with the active modules.
	 *
	 * Keys are the modules slugs and the values are their
	 * manifests.
	 */
	activeModules: Map<string, ModuleInterface>;

	/**
	 * Map with the modules paths associated with each correspondent
	 * module slug.
	 */
	modulesPaths: Map<string, string>;

	/**
	 * Contains all the actions who are part of each module.
	 */
	moduleActions: Map<string, string[]>;

	/**
	 * Register a new action name for a module.
	 *
	 * @param moduleName Module name.
	 * @param value Array of actions name to be stores.
	 */
	regModuleAction(moduleName: string, value: string | string[]): Result<true, string>;
}
