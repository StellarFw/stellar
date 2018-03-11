export type MiddlewareHandler = () => void;

export default interface MiddlewareInterface {
  /**
   * Name of the Middleware.
   */
  name: string;

  /**
   * Middleware priority.
   */
  priority?: number;

  create?: MiddlewareHandler;
  preProcessor?: MiddlewareHandler;
  postProcessor?: MiddlewareHandler;
  join?: MiddlewareHandler;
  say?: MiddlewareHandler;
  onSayReceive?: MiddlewareHandler;
  leave?: MiddlewareHandler;
  destroy?: MiddlewareHandler;
}
