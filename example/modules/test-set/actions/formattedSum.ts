import { Action } from "@stellarfw/common";
import { Inputs, Response as SumANumberResponse } from "./sumANumber";

type Response = {
	formatted: string;
};

export default {
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

	async run(param, api) {
		return (await api.actions.call<SumANumberResponse>("sumANumber", param)).map((res) => ({
			formatted: `${param.a} + ${param.b} = ${res.result}`,
		}));
	},
} as Action<Response, Inputs>;
