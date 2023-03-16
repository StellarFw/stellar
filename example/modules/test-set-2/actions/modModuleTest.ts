import { Action, ok } from "@stellarfw/common";

export const modModuleTest: Action<{ result: string }> = {
	name: "modModuleTest",
	description: "This action is used to test if the mod system supports modules",

	outputExample: {
		result: "OK",
	},

	async run(_params, _api, action) {
		return ok({
			result: action.metadata?.modProp ?? "not-found",
		});
	},
};
