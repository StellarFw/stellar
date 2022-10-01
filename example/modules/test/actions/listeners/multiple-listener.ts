import { Action, ActionMetadata } from "@stellarfw/common";

@ActionMetadata({
	name: "multipleListener",
	description: "This is a test for the multiple listeners support",
})
export class MultipleListenerAction extends Action {
	public async run() {
		const result = await this.api.events.fire("multiple", {
			value: "raw",
		});

		return {
			result,
		};
	}
}
