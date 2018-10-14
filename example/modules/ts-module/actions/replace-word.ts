import { Action } from "@stellarfw/common/action";
import { TActionInputs } from "@stellarfw/common/interfaces/action.interface";

export default class ReplaceWordsAction extends Action {
  public name = "replaceWords";
  public description = "This is a simple description";

  public inputs: TActionInputs = {
    text: {
      type: "string",
      required: true,
    },
    words: {
      type: "object",
    },
  };

  public async run() {
    console.log(">>> TEST");
  }
}
