import { Action, ok } from "@stellarfw/common";

type Inputs = {
	value: string;
};

type Response = {
	string: string;
};

export default {
	name: "inputDefault",
	description: "Test input default value",

	inputs: {
		value: {
			default: "DefaultVal",
		},
	},

	async run(params) {
		return ok({
			string: `Input > ${params.value}`,
		});
	},
} as Action<Response, Inputs>;
