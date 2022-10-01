import { Action, ActionMetadata } from "@stellarfw/common";

@ActionMetadata({
	name: "input-default",
	description: "Test input default value",

	inputs: {
		value: {
			default: "DefaultVal",
		},
	},
})
export class InputDefaultAction extends Action {
	public async run() {
		return {
			string: `Input > ${this.params.value}`,
		};
	}
}
