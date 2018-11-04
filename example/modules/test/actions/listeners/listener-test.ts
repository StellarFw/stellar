import { Action, ActionMetadata } from "@stellarfw/common";

@ActionMetadata({
  name: "listenerTest",
  description: "THis action tests the vent system",
})
export class ListenerTestAction extends Action {
  public async run() {
    const res = await this.api.events.fire("example", {
      value: "prev_value",
    });

    return {
      res,
    };
  }
}
