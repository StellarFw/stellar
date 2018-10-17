import { Action } from "@stellarfw/common/action";
import { ActionMetadata } from "@stellarfw/common/decorators/action-metadata.decorator";

@ActionMetadata({
  name: "replaceWords",
  description: "This is a simple description",
  inputs: {
    text: {
      type: "string",
      required: true,
    },
    words: {
      type: "object",
    },
  },
})
export default class ReplaceWordsAction extends Action {
  public async run() {
    console.log(`I'm here! 💪`);
  }
}
