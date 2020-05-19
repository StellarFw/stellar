export type MiddlewareHandler = () => void;

export interface MiddlewareInterface {
  /**
   * Name of the Middleware.
   */
  name: string;

  /**
   * Middleware priority.
   */
  priority?: number;

  /**
   * When set to `true` this will be applied to all actions.
   */
  global?: boolean;

  create?: MiddlewareHandler;
  preProcessor?: MiddlewareHandler;
  postProcessor?: MiddlewareHandler;
  join?: MiddlewareHandler;
  say?: MiddlewareHandler;
  onSayReceive?: MiddlewareHandler;
  leave?: MiddlewareHandler;
  destroy?: MiddlewareHandler;
}
