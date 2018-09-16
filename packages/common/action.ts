import { API } from "./interfaces/api.interface";
import { LogLevel } from "./enums/log-level.enum";
import {
  IActionInput,
  IAction,
  ActionRunFunction,
} from "./interfaces/action.interface";

/**
 * Abstract implementation of a Action.
 */
export abstract class Action implements IAction {
  /**
   * Reference for the API object.
   */
  private api: API;

  /**
   * Unique identifier of the action.
   */
  public name: string;

  /**
   * Description of what the action does.
   */
  public description: string;

  /**
   * Version number of the action.
   */
  public version: number = 1.0;

  /**
   * Group witch this action is part of.
   */
  public group: string;

  /**
   * Allows to specify the inputs for the action.
   *
   * This is used not only for documentation reasons
   * but also to apply restrictions to the passed values.
   */
  public inputs: IActionInput = {};

  /**
   * This is used to specify a output example. When present
   * it will be presented on the documentation page.
   */
  public outputExample?: any;

  /**
   * List of middleware to be applied to this list.
   */
  public middleware: Array<string> = [];

  /**
   * Allows to change the log level for this action.
   *
   * By default this is set to Info.
   */
  public logLevel: LogLevel = LogLevel.Info;

  /**
   * When true that means the action must be added to
   * the documentation
   */
  public toDocument: boolean = false;

  /**
   * Block certain types of connections.
   */
  public blockedConnectionTypes: Array<string>;

  /**
   * Allows to protect the action against overrides.
   */
  public protected: boolean = false;

  /**
   * Prevents action to be called from outside world.
   */
  public private: boolean = false;

  /**
   * Creates a new action instance
   *
   * @param api API reference.
   */
  constructor(api) {
    this.api = api;
  }

  public abstract run: ActionRunFunction;
}
