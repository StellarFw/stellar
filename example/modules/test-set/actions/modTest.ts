import { Action, ok } from "@stellarfw/common";

export const modTest: Action<{ result: string }> = {
	name: "modTest",
	description: "This action is used to test the action metadata manipulation",

	async run(_params, _api, action) {
		return ok({
			result: String(action.metadata?.modProp),
		});
	},
};

export const groupTest: Action<{ result: string }> = {
	name: "groupTest",
	description: "This action is used to test the group definition directly on the action",

	// this is the property that are under testing, this can't be changed without
	// pay attention to other files.
	group: "example",

	async run(_params, _api, action) {
		return ok({
			result: String(action.metadata?.modProp),
		});
	},
};

export const groupAddItems: Action<{
	result: string[];
}> = {
	name: "groupAddItems",
	description: "This action is used to rest the modification system",

	// this is the property that are under testing, this can't be changed without
	// pay attention to other files.
	group: "example",

	metadata: {
		customProp: ["a", "b"],
	},

	async run(_params, _api, action) {
		return ok({
			result: (action.metadata?.customProp as string[]) ?? [],
		});
	},
};

export const groupRmItem: Action<{
	result: string[];
}> = {
	name: "groupRmItem",
	description: "This action is used to test the modification system",

	// this is the property that are under testing, this can't be changed without
	// pay attention to other files.
	group: "example",

	metadata: {
		customProp2: ["a", "b"],
	},

	async run(_params, _api, action) {
		return ok({
			result: (action.metadata?.customProp2 as string[]) ?? [],
		});
	},
};
