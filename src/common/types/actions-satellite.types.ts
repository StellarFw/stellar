import { Result } from "../fp/result/result.interface.ts";
import { Action } from "./action.type.ts";
import { Middleware } from "./middleware.type.ts";

/**
 * Possible modifiers for the action's group
 */
export type GroupModifiers<Prop extends string = string> = `+${Prop}` | `-${Prop}`;

export interface IGroupMetadata {
	[prop: GroupModifiers]: Exclude<Action<unknown, unknown, unknown>, "name">;
}

/**
 * All actions with store organized by version number.
 */
export type ActionsStore = {
	[action: string]: {
		[version: number]: Action<unknown, unknown>;
	};
};

export interface IActionSatellite {
	/**
	 * Dictionary with the registered actions.
	 */
	actions: ActionsStore;

	/**
	 * Separate actions by version.
	 */
	versions: Map<string, Array<number>>;

	/**
	 * This map contains all the metadata changes to be applied to actions.
	 */
	groups: Map<string, IGroupMetadata>;

	/**
	 * This map stores the actions associated with a group.
	 */
	groupActions: Map<string, string[]>;

	/**
	 * Hash map with middleware by actions.
	 */
	middleware: { [key: string]: Middleware };

	/**
	 * Global middleware.
	 */
	globalMiddleware: Array<string>;

	/**
	 * Add a new middleware.
	 *
	 * @param data Middleware to be added.
	 */
	addMiddleware(data: Middleware): Result<true, string>;

	/**
	 * Allows to load a middleware from the given file.
	 *
	 * @param path Path of the middleware file to be loaded.
	 * @param reload This is for internal use.
	 */
	loadMiddlewareFromFile(path: string, reload?: boolean): Promise<Result<true, string>>;

	/**
	 * Load the modifier and apply it to all already loaded actions.
	 *
	 * @param modifier Modifier to be applied.
	 */
	applyModifier(modifier: unknown): void;

	/**
	 * Execute an action.
	 *
	 * @param actionName Name of the action to be called.
	 * @param params Action parameters.
	 */
	call<R, T = object, E = string | Error>(actionName: string, params?: T): Promise<Result<R, E>>;
}
