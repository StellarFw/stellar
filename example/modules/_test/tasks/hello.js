exports.sayHello = {
	name: "sayHello",
	description: "I say hello",

	queue: "default",
	frequency: 1000,

	async run() {
		// TODO: use the common module to get the LogLevel enumeration
		this.api.log("hello", "debug");
	},
};
