import { ok } from "../../../../src/common/fp/result/result.ts";
import { Action } from "../../../../src/common/types/action.type.ts";

export const sumANumber: Action<number, { a: number; b: number }> = {
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

	// disable documentation
	toDocument: false,

	// make this action private (this only can be called internally)
	private: true,

	run(params) {
		return ok(params.a + params.b);
	},
};

export const formattedSum: Action<
	{ formatted: string },
	{ a: number; b: number }
> = {
	name: "formattedSum",
	description: "Sum two numbers and return a formatted message with the result",
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

	outputExample: {
		formatted: "3 + 3 = 6",
	},

	async run(params, api) {
		// make a internal call to 'sumANumber' action
		const result = (await api.actions.call("sumANumber", params)).unwrap();

		// build a nice formatted string
		return ok({ formatted: `${params.a} + ${params.b} = ${result}` });
	},
};
