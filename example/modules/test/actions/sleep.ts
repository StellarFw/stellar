import { ok } from "../../../../src/common/fp/result/result.ts";
import { Action } from "../../../../src/common/types/action.type.ts";

export const sleep: Action<
	{
		sleepStarted: number;
		sleepEnded: number;
		sleepDelta: number;
		sleepDuration: number;
	},
	{ sleepDuration?: number }
> = {
	name: "sleep",
	description: "This action sleeps for a while and then returns",

	inputs: {
		sleepDuration: {
			description: "Duration to sleep in milliseconds",
			required: true,
			default: 1000,
		},
	},

	outputExample: {
		sleepStarted: 1457265602,
		sleepEnded: 1457265615,
		sleepDelta: 13,
		sleepDuration: 10,
	},

	async run(params) {
		const sleepDuration = params.sleepDuration ?? 1000;
		const sleepStarted = Date.now();

		await new Promise((resolve) => setTimeout(resolve, sleepDuration));

		const sleepEnded = Date.now();
		const sleepDelta = sleepEnded - sleepStarted;

		return ok({
			sleepStarted,
			sleepEnded,
			sleepDelta,
			sleepDuration,
		});
	},
};
