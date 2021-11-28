import { Action, IMiddleware } from ".";
import { Result } from "..";

export type GroupModifiers<Prop extends string = string> = `+${Prop}` | `-${Prop}`;

export interface IGroupMetadata {
  [prop: GroupModifiers]: Exclude<Action<unknown, unknown, unknown>, "name">;
}

export interface IActionSatellite {
  /**
   * Separate actions by version.
   */
  version: Map<string, Array<number>>;

  /**
   * This map contains all the metadata changes to be applied to actions.
   */
  groups: Map<string, IGroupMetadata>;

  /**
   * This map stores the actions associated with a group.
   */
  groupActions: Map<string, Array<Action<unknown, unknown, unknown>>>;

  /**
   * Hash map with middleware by actions.
   */
  middleware: { [key: string]: IMiddleware };

  /**
   * Global middleware.
   */
  globalMiddleware: Array<string>;

  /**
   * Add a new middleware.
   *
   * @param data Middleware to be added.
   */
  addMiddleware(data: IMiddleware): Result<true, string>;

  /**
   * Allows to load a middleware from the given file.
   *
   * @param path Path of the middleware file to be loaded.
   * @param reload This is for internal use.
   */
  loadMiddlewareFromFile(path: string, reload?: boolean): Result<true, string>;

  /**
   * Load the modifier and apply it to all already loaded actions.
   *
   * @param modifier Modifier to be applied.
   */
  applyModifier(modifier: unknown): void;

  /**
   * Execute an action.
   *
   * @param actionName Name of the action to be called.
   * @param params Action parameters.
   */
  call<T, R, E = string>(actionName: string, params?: T): Promise<Result<R, E>>;
}
