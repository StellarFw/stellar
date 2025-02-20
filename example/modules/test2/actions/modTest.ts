import { ok } from "../../../../src/common/fp/result/result.ts";
import { Action } from "../../../../src/common/types/action.type.ts";

export const modModuleTest: Action<{ result: string }> = {
	name: "modModuleTest",
	description: "This action is used to test if the mod system supports modules",

	outputExample: {
		result: "OK",
	},

	run(_params, _api, action) {
		return ok({ result: action.modProp as string });
	},
};
