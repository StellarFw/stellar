import { Action, ActionMetadata } from "@stellarfw/common";

@ActionMetadata({
  name: "formattedSum",
  description: "Sum two numbers and return a formatted message with the result",
  inputs: {
    a: {
      description: "First number",
      format: "integer",
      required: true,
    },
    b: {
      description: "Second number",
      format: "integer",
      required: true,
    },
  },

  outputExample: {
    formatted: "3 + 3 = 6",
  },
})
export class FormattedSumAction extends Action {
  public async run() {
    // make a internal call to 'sumANumber' action
    const { result } = await this.api.actions.call("sumANumber", this.params);

    return {
      formatted: `${this.params.a} + ${this.params.b} = ${result}`,
    };
  }
}
