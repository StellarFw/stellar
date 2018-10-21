import { API } from "./interfaces/api.interface";
import { IActionProcessor } from "./interfaces";

/**
 * Abstract implementation of a Action.
 */
export abstract class Action {
  /**
   * Reference for the API object.
   */
  private api: API;

  /**
   * This allows to access the action processor
   * responsible by this action.
   */
  private processor: IActionProcessor;

  /**
   * Parameters which the action has called with.
   */
  public params: { [key: string]: any } = {};

  /**
   * Creates a new action instance
   *
   * @param api API reference.
   */
  constructor(api, actionProcessor: IActionProcessor) {
    this.api = api;
    this.processor = actionProcessor;
  }

  public abstract run(): Promise<any>;
}
