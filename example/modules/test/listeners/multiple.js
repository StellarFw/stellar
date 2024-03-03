export default {
	event: ["multiple", "multiple_two"],
	description: `This event is used to test the multiple event support`,

	async run(api, params) {
		// add a '_mod' string at the end of the value
		return { value: `${params.value}_mod` };
	},
};
