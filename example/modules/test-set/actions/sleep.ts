import { Action, ok } from "@stellarfw/common";

type Inputs = {
	sleepDuration: number;
};

type Response = {
	sleepStarted: number;
	sleepEnded: number;
	sleepDelta: number;
	sleepDuration: number;
};

export default {
	name: "sleep",
	description: "Sleep for a while and then return",

	async run(params) {
		const sleepDuration = params.sleepDuration;
		const sleepStarted = new Date().getTime();

		return new Promise((resolve) => {
			setTimeout(() => {
				const sleepEnded = new Date().getTime();
				const sleepDelta = sleepEnded - sleepStarted;

				resolve(
					ok({
						sleepStarted,
						sleepEnded,
						sleepDelta,
						sleepDuration,
					}),
				);
			}, sleepDuration);
		});
	},
} as Action<Response, Inputs>;
