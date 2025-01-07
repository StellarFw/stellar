import { API } from "../src/interfaces/api.interface.ts";

/**
 * This is a temporary function util to run an action and return a promise.
 */
export function runActionPromise<T>(api: API, actionName: string, params = {}): Promise<T> {
	return new Promise((resolve, reject) => {
		try {
			api.helpers.runAction(actionName, params, (res) => (res.error ? reject(res.error) : resolve(res)));
		} catch (error) {
			reject(error);
		}
	});
}
