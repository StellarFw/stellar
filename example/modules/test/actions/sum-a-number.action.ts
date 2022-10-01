import { Action, ActionMetadata } from "@stellarfw/common";

@ActionMetadata({
	name: "sumANumber",
	description: "Sum two integer numbers",
	inputs: {
		a: {
			description: "First number",
			format: "integer",
			required: true,
		},
		b: {
			description: "Second number",
			format: "integer",
			required: true,
		},
	},

	// disable documentation
	toDocument: false,

	// make this action private (this only can be called internally)
	private: true,
})
export class SumANumberAction extends Action {
	public async run() {
		return {
			result: this.params.a + this.params.b,
		};
	}
}
