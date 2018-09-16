import { Action } from "@stellarfw/common/action";

export default class ReplaceWordsAction extends Action {
  name = "replaceWords"
  inputs = {
    text: {
      type: "string",
      required: true,
    }
  }

  async run() {
    console.log('>> TEST')
  }
}
