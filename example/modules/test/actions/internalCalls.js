export const sumANumber = {
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

	run(api, action) {
		return {
			result: action.params.a + action.params.b,
		};
	},
};

export const formattedSum = {
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

	async run(api, { params, response }) {
		// make a internal call to 'sumANumber' action
		const { result } = await api.actions.call("sumANumber", params);

		// build a nice formatted string
		response.formatted = `${params.a} + ${params.b} = ${result}`;
	},
};
