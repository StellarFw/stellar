import { Action, ActionMetadata } from "@stellarfw/common";

@ActionMetadata({
	name: "input-validator-predef-alpha-num",
	description: "Test pre-defined validator alpha numeric",
	inputs: {
		value: {
			description: "value to be validated",
			validator: "alpha_num",
		},
	},
})
export class InputValidatorPredefAlphaNumAction extends Action {
	public async run() {
		return {
			string: `Input > ${this.params.value}`,
		};
	}
}
