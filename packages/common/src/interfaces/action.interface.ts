import { API } from ".";
import { Result } from "..";
import { LogLevel } from "../enums/log-level.enum";

export type InputType = "string" | "number" | "object" | "array";

/**
 * Default available formats.
 */
export enum ActionFormat {
  Integer,
  Float,
  String,
}

/**
 * Structure of a format function.
 */
export type FormatFn<T> = <R>(x: T, api: API) => R;

/**
 * Action input.
 */
export interface ActionInput<T> {
  /**
   * Type of the input data.
   * TODO: see how to implement this
   */
  // type: InputType;

  /**
   * Input default value when there is no provided.
   */
  default?: T;

  /**
   * When set to true Stellar will force the param to exist.
   */
  required?: boolean;

  /**
   * Format function allows to format a parameter.
   */
  format?: ActionFormat | FormatFn<T>;

  /**
   * Allows to specify constraints to the input value.
   */
  validator?: string;
}

/**
 * Type for the inputs property.
 */
export interface ActionInputMap {
  [key: string]: ActionInput<unknown>;
}

/**
 * Action behaviour.
 */
export type ActionRunFunction<R, I, E = string> = (params: I) => Promise<Result<R, E>>;

export interface Action<R, I, E = string> {
  /**
   * A unique action identifier.
   *
   * It's recommended to use a namespace to eliminate the possibility
   * of collision, e.g. `auth.login`.
   */
  name: string;

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
  inputs: ActionInputMap;

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

  /**
   * Action logic.
   */
  run: ActionRunFunction<R, I, E>;
}

/**
 * Type used while action is being processed.
 */
export interface ProcessingAction<R, E> extends Action<R, E> {
  params: { [key: string]: unknown };
}
