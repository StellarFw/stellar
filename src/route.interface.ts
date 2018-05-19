/**
 * Represents a route.
 */
export interface RouteInterface {
  /**
   * Path that match with this route.
   */
  path: string;

  /**
   * Action to be executed when this path is matched.
   */
  action: string;

  /**
   * Action version to be used.
   */
  actionVersion?: number;

  /**
   * TODO: add documentation
   */
  matchTrailingPathParts?: boolean;
}
