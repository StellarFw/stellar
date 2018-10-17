import { API } from "./interfaces/api.interface";

/**
 * Abstract implementation of a Action.
 */
export abstract class Action {
  /**
   * Reference for the API object.
   */
  private api: API;

  /**
   * Creates a new action instance
   *
   * @param api API reference.
   */
  constructor(api) {
    this.api = api;
  }

  public abstract run(): Promise<any>;
}
