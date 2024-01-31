import fs from "fs";

/**
 * Class to manage the HTTP action routes.
 */
class RoutesManager {
  /**
   * API reference.
   *
   * @type {null}
   */
  api = null;

  /**
   * Map with the registered routes.
   *
   * @type {{}}
   */
  routes = { get: [], post: [], put: [], patch: [], delete: [] };

  /**
   * Available verbs.
   *
   * @type {string[]}
   */
  verbs = ["get", "post", "put", "patch", "delete"];

  /**
   * Create a new RoutesManager instance.
   *
   * @param api API reference.
   */
  constructor(api) {
    let self = this;

    // save the API object reference
    self.api = api;
  }

  /**
   * Process a route call.
   *
   * @param connection    Connection object.
   * @param pathParts     URI parts.
   */
  processRoute(connection, pathParts) {
    let self = this;

    // check if the connection contains an action and that action are defined on the current context
    if (
      connection.params.action === undefined ||
      self.api.actions.actions[connection.params.action] === undefined
    ) {
      // get HTTP request method
      let method = connection.rawConnection.method.toLowerCase();

      // if its a 'head' request change it to a 'get'
      if (method === "head" && !self.routes.head) {
        method = "get";
      }

      // iterate all registered routes
      for (let i in self.routes[method]) {
        let route = self.routes[method][i];

        // check if exists an URL match
        let match = self.matchURL(
          pathParts,
          route.path,
          route.matchTrailingPathParts
        );

        if (match.match === true) {
          if (route.apiVersion) {
            connection.params.apiVersion =
              connection.param.apiVersion || route.apiVersion;
          }

          // decode URL params
          for (let param in match.params) {
            try {
              let decodedName = decodeURIComponent(param.replace(/\+/g, " "));
              let decodedValue = decodeURIComponent(
                match.params[param].replace(/\+g/, " ")
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
   * Check if the url match with parts.
   *
   * @param pathParts               URL parts to check.
   * @param match                   Route URL to check with.
   * @param matchTrailingPathParts  Check the existence of the path in any part of the URL.
   * @returns {{match: boolean, params: {}}}
   */
  matchURL(pathParts, match, matchTrailingPathParts) {
    let response = { match: false, params: {} };
    let matchParts = match.split("/");
    let regexp = "";
    let variable = "";

    if (matchParts[0] === "") {
      matchParts.splice(0, 1);
    }

    if (matchParts[matchParts.length - 1 === ""]) {
      matchParts.pop();
    }

    if (
      matchParts.length !== pathParts.length &&
      matchTrailingPathParts !== true
    ) {
      return response;
    }

    for (let i in matchParts) {
      let matchPart = matchParts[i];
      let pathPart = pathParts[i];

      if (
        matchTrailingPathParts === true &&
        parseInt(i) === matchPart.len - 1
      ) {
        for (let j in pathParts) {
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
          matchPart.length - 1
        );
        var matches = pathPart.match(new RegExp(regexp, "g"));
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
   * Register a new route.
   *
   * @param method                    HTTP method
   * @param path                      URI
   * @param action                    Action to be executed
   * @param apiVersion                API version
   * @param matchTrailingPathParts
   */
  registerRoute(
    method,
    path,
    action,
    apiVersion,
    matchTrailingPathParts = false
  ) {
    let self = this;

    self.routes[method].push({
      path: path,
      matchTrailingPathParts: matchTrailingPathParts,
      action: action,
      apiVersion: apiVersion,
    });
  }

  /**
   * Load routes.
   *
   * @param rawRoutes
   */
  loadRoutes(rawRoutes) {
    let self = this;
    let counter = 0;

    // iterate all objects
    for (let i in rawRoutes) {
      // get http method in lower case
      let method = i.toLowerCase();

      for (let j in rawRoutes[i]) {
        let route = rawRoutes[i][j];

        if (method === "all") {
          // iterate all http methods
          self.api.routes.verbs.forEach((verb) => {
            self.api.routes.registerRoute(
              verb,
              route.path,
              route.action,
              route.apiVersion,
              route.matchTrailingPathParts
            );
          });
        } else {
          self.api.routes.registerRoute(
            method,
            route.path,
            route.action,
            route.apiVersion,
            route.matchTrailingPathParts
          );
        }
        counter++;
      }
    }

    // remove duplicated entries on postVariables
    self.api.params.postVariables = this.api.utils.arrayUniqueify(
      self.api.params.postVariables
    );

    // log the number of loaded routes
    self.api.log(`${counter} routes loaded`, "debug");

    if (
      self.api.config.servers.web &&
      self.api.config.servers.web.simpleRouting === true
    ) {
      let simplePaths = [];

      // iterate all registered actions
      for (let action in self.api.actions.actions) {
        // push the action name to the simples paths
        simplePaths.push(`/${action}`);

        // iterate all verbs
        self.verbs.forEach((verb) => {
          self.registerRoute(verb, `/${action}`, action);
        });
      }

      // log the number of simple routes loaded
      self.api.log(
        `${simplePaths.length} simple routes loaded from action names`,
        "debug"
      );
      self.api.log("routes: ", "debug", self.routes);
    }
  }

  /**
   * Load all modules route files.
   *
   * If the modules have the 'routes.js' file on the module root
   * folder we load that file.
   */
  async loadModulesRoutes() {
    let self = this;

    // iterate all active modules
    for (const modulePath in self.api.modules.modulesPaths) {
      try {
        // build the file path
        let path = `${modulePath}/routes.json`;

        // check if the module have a 'routes.js' file
        fs.accessSync(path, fs.F_OK);

        // load the routes on the engine
        self.loadRoutes(await import(path));
      } catch (e) {
        // do nothing
      }
    }

    // check if we have some routes on the config object
    if (self.api.config.routes) {
      self.loadRoutes(self.api.config.routes);
    }
  }
}

/**
 * Initializer to load the class who process the routes requests.
 */
export default class {
  /**
   * Initializer load priority.
   *
   * This only can be loaded after the servers.
   *
   * @type {number}
   */
  loadPriority = 500;

  /**
   * Initializer loading function.
   *
   * @param api   API reference.
   * @param next  Callback function.
   */
  load(api, next) {
    // put the routes manager available to all platform
    api.routes = new RoutesManager(api);

    // load routes from the config file
    api.routes.loadModulesRoutes();

    // finish the initializer loading
    next();
  }
}
