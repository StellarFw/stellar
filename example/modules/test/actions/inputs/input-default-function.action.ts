import { Action, ActionMetadata } from "@stellarfw/common";

@ActionMetadata({
  name: "input-default-function",
  description: `Test input default value using a function`,

  inputs: {
    value: {
      default() {
        return 156;
      },
    },
  },
})
export class InputDefaultFunctionAction extends Action {
  public async run() {
    return {
      value: this.params.value,
    };
  }
}
