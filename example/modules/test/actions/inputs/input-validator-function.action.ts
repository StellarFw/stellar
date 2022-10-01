import { Action, ActionMetadata } from "@stellarfw/common";

@ActionMetadata({
	name: "input-validator-function",
	description: "Test input function validator",

	inputs: {
		value: {
			validator: (param) => param === "asd",
		},
	},
})
export class InputValidatorFunctionAction extends Action {
	public async run() {
		return {
			string: `Input > ${this.params.value}`,
		};
	}
}
