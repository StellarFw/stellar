import { Action, ActionMetadata } from "@stellarfw/common";

@ActionMetadata({
	name: "randomNumber",
	description: "Generates a random number",

	outputExample: {
		number: 0.40420848364010453,
	},
})
export class RandomNumberAction extends Action {
	public async run() {
		const number = Math.random();
		return {
			number,
			formatedNumber: `Your random number is ${number}`,
		};
	}
}
