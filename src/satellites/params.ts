import { Satellite } from "../satellite";

export default class ParamsSatellite extends Satellite {
  protected _name: string = "params";
  public loadPriority: number = 420;

  /**
   * Special params.
   */
  private globalSafeParams: Array<string> = [
    "file",
    "apiVersion",
    "callback",
    "action",
  ];

  /**
   * List with all save params.
   */
  private postVariables: Array<string> = [];

  /**
   * Build a dictionary with all safe application params.
   */
  private buildPostVariables() {
    const postVariables = [];

    // Add global safe params.
    this.postVariables.concat(this.globalSafeParams);

    for (const i in this.api.actions.actions) {
      if (!this.api.actions.actions.hasOwnProperty(i)) {
        continue;
      }

      for (const j in this.api.actions.actions[i]) {
        if (!this.api.actions.actions[i].hasOwnProperty(j)) {
          continue;
        }

        // get current action
        const action = this.api.actions.actions[i][j];

        // iterate all inputs keys and add it to postVariables
        for (const key in action.inputs) {
          if (!action.inputs.hasOwnProperty(key)) {
            continue;
          }

          postVariables.push(key);
        }
      }
    }

    this.postVariables = this.api.utils.arrayUniqueify(postVariables);

    return this.postVariables;
  }

  public async load(): Promise<void> {
    this.api.params = this;
    this.buildPostVariables();
  }
}
