import { Action, ok } from "@stellarfw/common";

type Inputs = {
	value: number;
};

type Response = {
	value: number;
};

export default {
	name: "inputDefaultFunction",
	description: "Test input default value using a function",

	inputs: {
		value: {
			default() {
				return 156;
			},
		},
	},

	async run(params) {
		return ok({ value: params.value });
	},
} as Action<Response, Inputs>;
