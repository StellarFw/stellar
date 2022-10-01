import { Action, ActionMetadata } from "@stellarfw/common";

@ActionMetadata({
	name: "sleep",
	description: "This action sleep for a while and then return",

	inputs: {
		sleepDuration: {
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
})
export default class SleepAction extends Action {
	public async run() {
		const sleepDuration: number = this.params.sleepDuration;
		const sleepStarted = new Date().getTime();

		return new Promise((resolve) => {
			setTimeout(() => {
				const sleepEnded = new Date().getTime();
				const sleepDelta = sleepEnded - sleepStarted;

				resolve({
					sleepStarted,
					sleepEnded,
					sleepDelta,
					sleepDuration,
				});
			}, sleepDuration);
		});
	}
}
