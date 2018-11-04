import { Action, ActionMetadata } from "@stellarfw/common";

@ActionMetadata({
  name: "input-validator-regex",
  description: "Test input string validator",

  inputs: {
    value: {
      validator: /^\d{3}$/,
    },
  },
})
export class InputValidatorRegexAction extends Action {
  public async run() {
    return {
      string: `Input > ${this.params.value}`,
    };
  }
}
