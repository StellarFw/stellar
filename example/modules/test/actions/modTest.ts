import { ok } from "../../../../src/common/fp/result/result.ts";
import { Action } from "../../../../src/common/types/action.type.ts";

export const modTest: Action<{ result: string }> = {
	name: "modTest",
	description: "This action is used to test the action metadata manipulation",

	outputExample: {
		result: "OK",
	},

	run(_, _api, action) {
		// TODO: for now this can happen, but having a specific place for metadata may be better than this
		return ok({ result: action.modProp });
	},
};

export const groupTest: Action<{ result: string }> = {
	name: "groupTest",
	description:
		"This action is used to test the group definition directly on the action",

	// this is the property that is under testing, this can't be changed without
	// paying attention to other files.
	group: "example",

	outputExample: {
		result: "OK",
	},

	run(_, _api, action) {
		return ok({ result: action.modProp });
	},
};

export const groupAddItems: Action<{ result: string[] }> = {
	name: "groupAddItems",
	description: "This action is used to test the modification system",

	// this is the property that is under testing, this can't be changed without
	// paying attention to other files.
	group: "example",

	customProp: ["a", "b"],

	outputExample: {
		result: ["a", "b"],
	},

	run(_, _api, action) {
		return ok({ result: action.customProp });
	},
};

export const groupRmItems: Action<{ result: string[] }> = {
	name: "groupRmItems",
	description: "This action is used to test the modification system",

	// this is the property that is under testing, this can't be changed without
	// paying attention to other files.
	group: "example",

	customProp2: ["a", "b"],

	outputExample: {
		result: ["a", "b"],
	},

	run(_, _api, action) {
		return ok({ result: action.customProp2 as string[] });
	},
};
