exports.sayHello = {
	name: "runAction",
	description: "Run an action and return the connection object",

	queue: "default",

	async run(params = {}) {
		// TODO: use the common module to get the LogLevel enumeration
		try {
			const response = await this.api.actions.call(params.action, params);
			this.api.log(`[ action @ task ]`, "debug", { params: JSON.stringify(params) });
			return response;
		} catch (error) {
			this.api.log(`task error: ${error}`, "error", { params: JSON.stringify(params) });
			throw error;
		}
	},
};
