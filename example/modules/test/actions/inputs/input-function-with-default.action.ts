import { Action, ActionMetadata } from "@stellarfw/common";

@ActionMetadata({
	name: "input-function-with-default",
	description: "this action has some required params",
	version: 1,

	inputs: {
		requiredParam: { required: true },
		optionalParam: { required: false },
		fancyParam: {
			default: "test123",

			validator(s) {
				if (s === undefined || s === "test123") {
					return true;
				}

				return `fancyParam should be 'test123'. so says ${this.id}`;
			},
		},
	},
})
export class InputFunctionWithDefaultAction extends Action {
	public async run() {
		return {
			params: this.params,
		};
	}
}
