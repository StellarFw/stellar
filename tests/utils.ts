import { API } from "../src/common/types/api.types.ts";
import Engine from "../src/engine.ts";

/**
 * This is a temporary function util to run an action and return a promise.
 */
export function runActionPromise<T>(api: API, actionName: string, params = {}): Promise<T> {
	return api.helpers.runAction(actionName, params);
}

const buildEngineArgs = () => ({
	rootPath: `${Deno.cwd()}/example`,
	env: "test",
});

/**
 * Build Stellar engine instance and return it.
 */
export const buildTestEngine = () => {
	// TODO: add support to set the environment via scope object
	Deno.env.set("STELLAR_ENV", "test");
	return new Engine(buildEngineArgs());
};
