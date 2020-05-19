import { LogLevel } from "../enums/log-level.enum";

/**
 * Type for the inputs property.
 */
export interface IActionInput {
  [key: string]: any;
}

export type ActionRunFunction = () => Promise<any>;

export interface IActionMetadata {
  /**
   * A unique action identifier.
   *
   * It's recommended to use a namespace to eliminate the possibility
   * of collision, e.g. `auth.login`.
   */
  name?: string;

  /**
   * Describes the action.
   *
   * This information is used in automatic documentation.
   */
  description?: string;

  /**
   * Action version.
   *
   * This allow to have multiple action with the same name for
   * in different versions.
   */
  version?: number;

  /**
   * Enumerate the action's input parameters.
   *
   * You can also apply restrictions to allowed inputted values.
   */
  inputs?: IActionInput;

  /**
   * Group which this action is part of.
   *
   * This is used to apply batch edits to actions.
   */
  group?: string;

  /**
   * Array of middleware to be applied to the action.
   */
  middleware?: Array<string>;

  /**
   * Contains an example of an action response.
   *
   * This example will be used in automatic documentation.
   */
  outputExample?: any;

  /**
   * Block certain types of connections.
   */
  blockedConnectionTypes?: Array<string>;

  /**
   * Defines how the action should be logged.
   */
  logLevel?: LogLevel;

  /**
   * Allow protect the action against overrides.
   *
   * When `true`, prevent the action to be overridden by a higher priority
   * module.
   */
  protected?: boolean;

  /**
   * Prevent action to be called from outside world.
   */
  private?: boolean;

  /**
   * Allows set if this action should be parte of the docs.
   *
   * By default, this property is set to `true`, otherwise documentation will
   * not be generated for the action.
   */
  toDocument?: boolean;
}
