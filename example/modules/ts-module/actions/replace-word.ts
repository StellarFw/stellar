import { Action, ActionMetadata } from "@stellarfw/common";

@ActionMetadata({
  name: "replaceWords",
  description: "This is a simple description",
  inputs: {
    text: {
      type: "string",
      required: true,
    },
    target: {
      type: "object",
      required: true,
    },
    replacement: {
      type: "string",
      required: true,
    },
  },
})
export default class ReplaceWordsAction extends Action {
  public async run() {
    const newText = (this.params.text as string).replace(
      this.params.target,
      this.params.replacement,
    );

    return {
      newText,
    };
  }
}
