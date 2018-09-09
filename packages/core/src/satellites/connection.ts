import { Satellite } from "@stellarfw/common/satellite";
import Connection from "@stellarfw/common/connection";

export default class ConnectionSatellite extends Satellite {
  protected _name: string = "connection";
  public loadPriority: number = 400;

  /**
   * Dictionary with all registered middleware.
   */
  public middleware: any = {};

  /**
   * Array with global middleware.
   */
  public globalMiddleware: Array<string> = [];

  /**
   * Array with the allowed verbs.
   */
  private allowedVerbs: Array<string> = [
    "quit",
    "exit",
    "paramAdd",
    "paramDelete",
    "paramView",
    "paramsView",
    "paramsDelete",
    "roomJoin",
    "roomLeave",
    "roomView",
    "detailsView",
    "say",
    "event",
  ];

  /**
   * Dictionary with the active connections.
   */
  public connections: Map<string, Connection> = new Map();

  public async load(): Promise<void> {
    this.api.connections = this;
  }

  /**
   * Add a new middleware.
   *
   * @param data  Middleware to be added.
   */
  public addMiddleware(data) {
    // Middleware require a name
    if (!data.name) {
      throw new Error("middleware.name is required");
    }

    // if there is no defined priority use the default
    if (!data.priority) {
      data.priority = this.api.config.general.defaultMiddlewarePriority;
    }

    data.priority = Number(data.priority);

    // save the new middleware
    this.middleware[data.name] = data;

    // push the new middleware to the global list
    this.globalMiddleware.push(data.name);

    // sort the global middleware array
    this.globalMiddleware.sort((a, b) => {
      if (this.middleware[a].priority > this.middleware[b].priority) {
        return 1;
      }

      return -1;
    });
  }

  public apply(connectionId, method = null, args = null) {
    return this.api.redis._doCluster(
      "connections.applyCatch",
      [connectionId, method, args],
      connectionId,
    );
  }

  public async applyCatch(connectionId, method = null, args = null) {
    const connection = this.connections.get(connectionId);

    if (method && args) {
      if (method === "sendMessage" || method === "sendFile") {
        connection[method](args);
      } else {
        connection[method].apply(connection, args);
      }
    }

    // TODO: do we need to return a clean connection?
  }
}
