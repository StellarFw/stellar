import { Action, ok } from "@stellarfw/common";

export type Inputs = {
	a: number;
	b: number;
};

export type Response = {
	result: number;
};

export default {
	name: "sumANumber",
	description: "Sum two integer numbers",

	inputs: {
		a: {
			description: "First number",
			format: "integer",
			required: true,
		},
		b: {
			description: "Second number",
			format: "integer",
			required: true,
		},
	},

	toDocument: false,
	private: true,

	async run(params) {
		return ok({ result: params.a + params.b });
	},
} as Action<Response, Inputs>;
