export const modModuleTest = {
	name: "modModuleTest",
	description: "This action is used to test if the mod system supports modules",

	outputExample: {
		result: "OK",
	},

	run(api, action) {
		action.response.result = action.actionTemplate.modProp;
	},
};
