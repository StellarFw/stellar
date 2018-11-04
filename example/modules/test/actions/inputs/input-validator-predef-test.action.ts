import { Action, ActionMetadata } from "@stellarfw/common";

@ActionMetadata({
  name: "input-validator-predef-test",
  description: "Test pre-defined validator generic test",
  inputs: {
    value: {
      validator: "url",
    },
  },
})
export class InputValidatorPredefTestAction extends Action {
  public async run() {
    return {
      string: `Input > ${this.params.value}`,
    };
  }
}
