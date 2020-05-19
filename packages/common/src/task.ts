import { API } from "./interfaces";

export abstract class Task {
  /**
   * Reference for the API object.
   */
  protected api: API;

  /**
   * Parameters which the task has called with
   */
  public params: { [key: string]: any } = {};

  /**
   * Creates a new task instance.
   * @param api Global API reference.
   */
  constructor(api: API) {
    this.api = api;
  }

  public abstract run(): Promise<any>;
}
