import { Satellite } from "@stellarfw/common/satellite";
import { RouteInterface } from "@stellarfw/common/interfaces/route.interface";
import { LogLevel } from "@stellarfw/common/enums/log-level.enum";
import ConnectionDetails from "@stellarfw/common/interfaces/connection-details.interface";

interface RouterDictionary {
  GET: Array<RouteInterface>;
  POST: Array<RouteInterface>;
  PUT: Array<RouteInterface>;
  PATCH: Array<RouteInterface>;
  DELETE: Array<RouteInterface>;
  HEAD: Array<RouterDictionary>;
}

/**
 * Available verbs.
 */
enum Verbs {
  GET = "GET",
  POST = "POST",
  PUT = "PUT",
  PATCH = "PATCH",
  DELETE = "DELETE",
  HEAD = "HEAD",
  ALL = "ALL",
}

export default class RoutesSatellite extends Satellite {
  public _name: string = "Routes";
  public loadPriority: number = 500;

  /**
   * Map with the registered routes.
   */
  private routes: RouterDictionary = {
    GET: [],
    POST: [],
    PUT: [],
    PATCH: [],
    DELETE: [],
    HEAD: [],
  };

  /**
   *
   * @param method HTTP Verb.
   * @param path Path that match with the route.
   * @param action Action to be executed.
   * @param actionVersion Version of the action to be executed.
   * @param matchTrailingPathParts
   */
  private registerRoute(
    method: Verbs,
    path: string,
    action: string,
    actionVersion: number = 1,
    matchTrailingPathParts: boolean = false,
  ): void {
    const route: RouteInterface = {
      path,
      matchTrailingPathParts,
      action,
      actionVersion,
    };

    this.routes[method].push(route);
  }

  /**
   * Check if the url match with parts.
   *
   * @param pathParts               URL parts to check.
   * @param match                   Route URL to check with.
   * @param matchTrailingPathParts  Check the existence of the path in any part of the URL.
   * @returns {{match: boolean, params: {}}}
   */
  private matchURL(
    pathParts: Array<string>,
    match: string,
    matchTrailingPathParts: boolean = false,
  ) {
    const response = { match: false, params: {} };
    const matchParts = match.split("/");
    let regexp = "";
    let variable = "";

    if (matchParts[0] === "") {
      matchParts.splice(0, 1);
    }

    if (matchParts[matchParts.length - 1] === "") {
      matchParts.pop();
    }

    if (
      matchParts.length !== pathParts.length &&
      matchTrailingPathParts !== true
    ) {
      return response;
    }

    for (const i in matchParts) {
      if (!matchParts.hasOwnProperty(i)) {
        continue;
      }

      const matchPart = matchParts[i];
      let pathPart = pathParts[i];

      if (
        matchTrailingPathParts === true &&
        parseInt(i, 10) === matchPart.length - 1
      ) {
        for (const j in pathParts) {
          if (!pathParts.hasOwnProperty(j)) {
            continue;
          }

          if (j > i) {
            pathPart = `${pathPart}/${pathParts[j]}`;
          }
        }
      }

      if (!pathPart) {
        return response;
      } else if (matchPart[0] === ":" && matchPart.indexOf("(") < 0) {
        variable = matchPart.replace(":", "");
        response.params[variable] = pathPart;
      } else if (matchPart[0] === ":" && matchPart.indexOf("(") >= 0) {
        variable = matchPart.replace(":", "").split("(")[0];
        regexp = matchPart.substring(
          matchPart.indexOf("(") + 1,
          matchPart.length - 1,
        );
        const matches = pathPart.match(new RegExp(regexp, "g"));
        if (matches) {
          response.params[variable] = pathPart;
        } else {
          return response;
        }
      } else {
        if (
          pathPart === null ||
          pathPart === undefined ||
          pathParts[i].toLowerCase() !== matchPart.toLowerCase()
        ) {
          return response;
        }
      }
    }

    response.match = true;

    return response;
  }

  /**
   * Process a router call.
   *
   * @param connection Client connection object.
   * @param pathParts Path to be tested.
   */
  public processRoute(connection: ConnectionDetails, pathParts: Array<string>) {
    // check if the connection contains an action and that action are defined on the current context
    if (
      connection.params.action === undefined ||
      this.api.actions.actions[connection.params.action] === undefined
    ) {
      let method = connection.rawConnection.method.toLowerCase();

      // if its a 'head' request change it to a 'get'
      if (method === Verbs.HEAD && this.routes.HEAD.length === 0) {
        method = Verbs.GET;
      }

      for (const i in this.routes[method]) {
        if (!this.routes[method].hasOwnProperty(i)) {
          continue;
        }

        const route = this.routes[method][i];

        const match = this.matchURL(
          pathParts,
          route.path,
          route.matchTrailingPathParts,
        );

        if (match.match === true) {
          if (route.apiVersion) {
            connection.params.apiVersion =
              connection.params.apiVersion || route.apiVersion;
          }

          // decode URL params
          for (const param in match.params) {
            if (!match.params.hasOwnProperty(param)) {
              continue;
            }

            try {
              const decodedName = decodeURIComponent(param.replace(/\+/g, " "));
              const decodedValue = decodeURIComponent(
                match.params[param].replace(/\+g/, " "),
              );
              connection.params[decodedName] = decodedValue;
            } catch (e) {
              // malformed URL
            }
          }

          // put the action in the connection
          connection.params.action = route.action;
          break;
        }
      }
    }
  }

  /**
   * Load routes.
   *
   * @param routes Routes to be processed
   */
  private loadRoutes(routes: RouterDictionary): void {
    let counter: number = 0;

    for (const i in routes) {
      if (!routes.hasOwnProperty(i)) {
        continue;
      }

      const method = Verbs[i.toUpperCase()];

      for (const j in routes[i]) {
        if (!routes[i].hasOwnProperty(j)) {
          continue;
        }

        const route = routes[i][j];

        if (method === Verbs.ALL) {
          Object.keys(Verbs).forEach((verb: string) => {
            this.registerRoute(
              Verbs[verb],
              route.path,
              route.action,
              route.apiVersion,
              route.matchTrailingPathParts,
            );
          });
        } else {
          this.registerRoute(
            method,
            route.path,
            route.action,
            route.apiVersion,
            route.matchTrailingPathParts,
          );
        }

        counter += 1;
      }
    }

    // remove duplicated entries on postVariables
    this.api.params.postVariables = this.api.utils.arrayUniqueify(
      this.api.params.postVariables,
    );

    this.api.log(`${counter} routes loaded`, LogLevel.Debug);

    if (
      this.api.configs.servers.web &&
      this.api.configs.servers.web.simpleRouting === true
    ) {
      const simplePaths = [];

      for (const action in this.api.actions.actions) {
        if (!this.api.actions.actions.hasOwnProperty(action)) {
          continue;
        }

        simplePaths.push(`/${action}`);

        Object.keys(Verbs).forEach((verb: string) => {
          if (verb === Verbs.ALL) {
            return;
          }

          this.registerRoute(Verbs[verb], `/${action}`, action);
        });
      }

      // log the number of simple routes loaded
      this.api.log(
        `${simplePaths.length} simple routes loaded from action names`,
        LogLevel.Debug,
      );
      this.api.log("routes: ", LogLevel.Debug, this.routes);
    }
  }

  /**
   * Load all modules routes files.
   *
   * If the modules have a `routes.js` file on the modules root
   * folder we load that file.
   */
  private loadModulesRoutes() {
    this.api.modules.modulesPaths.forEach((modulePath: string) => {
      // Try loading the JS version of the routes
      let path = `${modulePath}/routes.json`;
      if (this.api.utils.fileExists(path)) {
        this.loadRoutes(require(path));
      }

      path = `${modulePath}/routes.js`;
      if (this.api.utils.fileExists(path)) {
        this.loadRoutes(require(path).default);
      }
    });

    if (this.api.configs.routes) {
      this.loadRoutes(this.api.configs.routes);
    }
  }

  public async load(): Promise<void> {
    this.api.routes = this;

    this.loadModulesRoutes();
  }
}
