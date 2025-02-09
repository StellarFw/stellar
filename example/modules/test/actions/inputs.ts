import { ok } from "../../../../src/common/fp/result/result.ts";
import { Action } from "../../../../src/common/types/action.type.ts";

export const inputRequire: Action<{ string: string }, { value: string }> = {
	name: "inputRequire",
	description: "Test input require property",

	inputs: {
		value: {
			description: "Required value",
			required: true,
		},
	},

	run(params) {
		return ok({ string: `Input > ${params.value}` });
	},
};

export const inputDefault: Action<{ string: string }, { value?: string }> = {
	name: "inputDefault",
	description: "Test input default value",

	inputs: {
		value: {
			description: "Value with default",
			default: "DefaultVal",
		},
	},

	run(params) {
		return ok({ string: `Input > ${params.value}` });
	},
};

export const inputDefaultFunction: Action<
	{ value: number },
	{ value?: number }
> = {
	name: "inputDefaultFunction",
	description: "Test input default value using a function",

	inputs: {
		value: {
			description: "Value with default function",
			default() {
				return 156;
			},
		},
	},

	run(params) {
		return ok({ value: params.value });
	},
};

export const inputDefaultFunctionApi: Action<
	{ value: number },
	{ value?: number }
> = {
	name: "inputDefaultFunctionApi",
	description: "Test input default value using a function and the API object",

	inputs: {
		value: {
			description: "Value with API-based default",
			default(api) {
				return api.config.testValue;
			},
		},
	},

	async run(params) {
		return ok({ value: params.value });
	},
};

export const inputValidatorRegex: Action<
	{ string: string },
	{ value: string }
> = {
	name: "inputValidatorRegex",
	description: "Test input string validator",

	inputs: {
		value: {
			description: "Value with regex validation",
			validator: /^\d{3}$/,
		},
	},

	run(params) {
		return ok({ string: `Input > ${params.value}` });
	},
};

export const inputValidatorFunction: Action<
	{ string: string },
	{ value: string }
> = {
	name: "inputValidatorFunction",
	description: "Test input function validator",

	inputs: {
		value: {
			description: "Value with function validation",
			validator: (param) => param === "asd",
		},
	},

	run(params) {
		return ok({ string: `Input > ${params.value}` });
	},
};

export const inputValidatorPredefAlpha: Action<
	{ string: string },
	{ value: string }
> = {
	name: "inputValidatorPredefAlpha",
	description: "Test pre-defined validator alpha",

	inputs: {
		value: {
			description: "Value must be alphabetic",
			validator: "alpha",
		},
	},

	run(params) {
		return ok({ string: `Input > ${params.value}` });
	},
};

export const inputValidatorPredefAlphaNum: Action<
	{ string: string },
	{ value: string }
> = {
	name: "inputValidatorPredefAlphaNum",
	description: "Test pre-defined validator alpha numeric",

	inputs: {
		value: {
			description: "Value must be alphanumeric",
			validator: "alpha_num",
		},
	},

	run(params) {
		return ok({ string: `Input > ${params.value}` });
	},
};

export const inputValidatorPredefTest: Action<
	{ string: string },
	{ value: string }
> = {
	name: "inputValidatorPredefTest",
	description: "Test pre-defined validator generic test",

	inputs: {
		value: {
			description: "Value must be a valid URL",
			validator: "url",
		},
	},

	run(params) {
		return ok({ string: `Input > ${params.value}` });
	},
};

export const inputValidatorInvalid: Action<
	{ string: string },
	{ value: string }
> = {
	name: "inputValidatorInvalid",
	description:
		"This uses an invalid validator to test if the error message appears",

	inputs: {
		value: {
			description: "Invalid validator test",
			validator: "some_random_string",
		},
	},

	run(params) {
		return ok({ string: `Input > ${params.value}` });
	},
};

export const inputValidatorMultiple: Action<
	{ success: boolean },
	{ name: string; phone: string; someField?: string }
> = {
	name: "inputValidatorMultiple",
	description: "Used to test multiple restrictions to the inputs",

	inputs: {
		name: { description: "Alphabetic name", validator: "alpha" },
		phone: { description: "Numeric phone number", validator: "numeric" },
		someField: {
			description: "Required if phone is 123",
			validator: "required_if:phone,123",
		},
	},

	run() {
		return ok({ success: true });
	},
};

export const inputFunctionWithDefault: Action<
	{ params: any },
	{ requiredParam: string; optionalParam?: string; fancyParam?: string }
> = {
	name: "inputFunctionWithDefault",
	description: "This action has some required params",
	version: 1,

	inputs: {
		requiredParam: { description: "Required parameter", required: true },
		optionalParam: { description: "Optional parameter", required: false },
		fancyParam: {
			description: "Fancy parameter with default and validation",
			default: "test123",
			validator(s) {
				if (s === undefined || s === "test123") {
					return true;
				}
				return `fancyParam should be 'test123'. so says ${this.id}`;
			},
		},
	},

	run(params) {
		return ok({ params });
	},
};
