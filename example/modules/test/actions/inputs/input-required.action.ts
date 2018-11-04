import { Action, ActionMetadata } from "@stellarfw/common";

@ActionMetadata({
  name: "input-require",
  description: "Test input require property",

  inputs: {
    value: {
      required: true,
    },
  },
})
export class InputRequiredAction extends Action {
  public async run() {
    return {
      string: `Input > ${this.params.value}`,
    };
  }
}
