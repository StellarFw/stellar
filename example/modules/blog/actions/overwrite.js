export default {
	name: "test",
	description: "Just to test overwrite protection",

	async run(engine, data) {
		return {
			string: "overwrite",
		};
	},
};
