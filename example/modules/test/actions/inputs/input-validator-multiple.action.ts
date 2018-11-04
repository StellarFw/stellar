import { Action, ActionMetadata } from "@stellarfw/common";

@ActionMetadata({
  name: "input-validator-multiple",
  description: `Used to test multiple restrictions to the inputs`,

  inputs: {
    name: { validator: "alpha" },
    phone: { validator: "numeric" },
    someField: { validator: "required_if:phone,123" },
  },
})
export class InputValidatorMultipleAction extends Action {
  public async run() {
    return {
      success: true,
    };
  }
}
