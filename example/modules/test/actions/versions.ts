import { Action, ActionMetadata } from "@stellarfw/common";

@ActionMetadata({
	name: "versionedAction",
	description: "Is just a dummy action with a version property",
	version: 1,
})
export class VersionedAction1 extends Action {
	public async run() {}
}

@ActionMetadata({
	name: "versionedAction",
	description: "Is just a dummy action with a version property",
	version: 2,

	outputExample: {
		news: "new version",
	},
})
export class VersionedAction2 extends Action {
	public async run() {
		return {
			news: "new version",
		};
	}
}
