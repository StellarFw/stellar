import { Action, ActionMetadata } from "@stellarfw/common";

@ActionMetadata({
  name: "isolated.action",
  description: "This is an example of a namespaced action",

  outputExample: {
    success: "ok",
  },
})
export class NamespacedAction extends Action {
  public async run() {
    return {
      success: "ok",
    };
  }
}
