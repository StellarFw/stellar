import { Action, ActionMetadata } from "@stellarfw/common";

@ActionMetadata({
	name: "modTest",
	description: "This action is used to test the action metadata manipulation",

	outputExample: {
		result: "OK",
	},
})
export class ModTestAction extends Action {
	public async run() {
		return {
			// TODO: update the mod system to match the new action structure
			// result: this.actionTemplate.modProp,
		};
	}
}
