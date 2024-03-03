/**
 * This is just an example to show the usage of a listener.
 */
export const example = {
	event: "example",
	async run() {
		// change the param value to 'thisIsATest'
		return { value: "thisIsATest" };
	},
};
