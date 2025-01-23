export default {
	event: ["multiple", "multiple_two"],
	description: `This event is used to test the multiple event support`,

	run(api, params, next) {
		// add a '_mod' string at the end of the value
		params.value += "_mod";

		// finish the event execution
		next();
	},
};
