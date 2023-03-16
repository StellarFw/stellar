import { Action, ok } from "@stellarfw/common";

type Response = {
	id: string;
	stellarVersion: string;
	uptime: number;
};

export default {
	name: "status",
	description: "Returns some basic information about the core",

	outputExample: {
		id: "example",
		stellarVersion: "1.0.0",
		uptime: 10030,
	},

	async run(_, api) {
		return ok({
			id: api.id,
			stellarVersion: api.stellarVersion,
			uptime: new Date().getTime() - api.bootTime,
		});
	},
} as Action<Response>;
