import { Action, ActionMetadata } from "@stellarfw/common";

@ActionMetadata({
  name: "input-validator-predef-alpha",
  description: "Test pre-defined validator alpha",

  inputs: {
    value: {
      validator: "alpha",
    },
  },
})
export class InputValidatorPredefAlphaAction extends Action {
  public async run() {
    return {
      string: `Input > ${this.params.value}`,
    };
  }
}
