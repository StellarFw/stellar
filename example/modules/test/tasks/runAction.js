export const sayHello = {
	name: "runAction",
	description: "Run an action and return the connection object",

	queue: "default",
	frequency: 0,

	run(api, params = {}, next) {
		// execute the requested action
		api.actions
			.call(params.action, params)
			.then((response) => {
				// log the task call
				api.log(`[ action @ task ]`, "debug", {
					params: JSON.stringify(params),
				});

				next(null, response);
			})
			.catch((error) => {
				// log the error
				api.log(`task error: ${error}`, "error", {
					params: JSON.stringify(params),
				});

				next(error, null);
			});
	},
};
