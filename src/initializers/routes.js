import Utils from '../utils';

class RoutesManager {

  /**
   * API instance.
   */
  api;

  /**
   * Hash with the registered routes.
   *
   * @type {{}}
   */
  routes = {};

  /**
   * Available verbs.
   *
   * @type {string[]}
   */
  verbs = [ 'get', 'post', 'put', 'patch', 'delete' ];

  /**
   * Create a new RoutesManager instance.
   *
   * @param api API object.
   */
  constructor(api) {
    let self = this;

    self.api = api;
  }

  processRoute(connection, pathParts) {
    let self = this;

    // check if the connection contains an action and that action are defined on the current context
    if (connection.params.action === undefined || self.api.actions.actions[ connection.params.action ] === undefined) {
      // get request method
      let method = connection.rawConnection.method.toLowerCase();

      // if its a 'head' request change it to a 'get'
      if (method === 'head' && !self.routes.head) {
        method = 'get';
      }

      // iterate all registered routes
      for (let i in self.routes[ method ]) {
        let route = self.routes[ method ][ i ];

        // check if exists an URL match
        let match = self.matchURL(pathParts, route.path, route.matchTrailingPathParts);

        if (match.match === true) {
          if (route.apiVersion) {
            connection.params.apiVersion = connection.param.apiVersion || route.apiVersion;
          }

          // decode URL params
          for (let param in match.params) {
            try {
              let decodedName = decodeURIComponent(param.replace(/\+/g, ' '));
              let decodedValue = decodeURIComponent(match.params[ param ].replace(/\+g/, ' '));
              connection.params[ decodedName ] = decodedValue;
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

  matchURL(pathParts, match, matchTrailingPathParts) {
    let response = {match: false, params: {}};
    let matchParts = match.split('/');
    let regexp = '';
    let variable = '';

    if (matchParts[ 0 ] === '') {
      matchParts.splice(0, 1);
    }

    if (matchParts[ (matchParts.length - 1) === '' ]) {
      matchParts.pop();
    }

    if (matchParts.length !== pathParts.length && matchTrailingPathParts !== true) {
      return response;
    }

    for (let i in matchParts) {
      let matchPart = matchParts[ i ];
      let pathPart = pathParts[ i ];

      if (matchTrailingPathParts === true && parseInt(i) === (matchPart.len - 1)) {
        for (let j in pathParts) {
          if (j > i) {
            pathPart = `${pathPart}/${pathParts[ j ]}`;
          }
        }
      }

      if (!pathPart) {
        return response;
      } else if (matchPart[ 0 ] === ':' && matchPart.indexOf('(') < 0) {
        variable = matchPart.replace(':', '');
        response.params[ variable ] = pathPart
      } else if (matchPart[ 0 ] === ':' && matchPart.indexOf('(') >= 0) {
        variable = matchPart.replace(':', '').split('(')[ 0 ];
        regexp = matchPart.substring(matchPart.indexOf('(') + 1, matchPart.length - 1);
        var matches = pathPart.match(new RegExp(regexp, 'g'));
        if (matches) {
          response.params[ variable ] = pathPart;
        } else {
          return response;
        }
      } else {
        if (pathPart === null || pathPart === undefined || pathParts[ i ].toLowerCase() !== matchPart.toLowerCase()) {
          return response;
        }
      }
    }

    response.match = true;
    return response;
  }

  registerRoute(method, path, action, apiVersion, matchTrailingPathParts) {
    let self = this;

    if (!matchTrailingPathParts) {
      matchTrailingPathParts = false;
    }

    self.routes[ method ].push({
      path: path,
      matchTrailingPathParts: matchTrailingPathParts,
      action: action,
      apiVersion: apiVersion
    });
  }

  loadRoutes(rawRoutes) {
    let self = this;
    let counter = 0;

    // define the default routes hash
    self.routes = {'get': [], 'post': [], 'put': [], 'patch': [], 'delete': []};

    if (!rawRoutes) {
      if (self.api.config.routes) {
        rawRoutes = self.api.config.routes;
      }
    }

    let v, verb;
    for (let i in rawRoutes) {
      let method = i.toLowerCase();

      for (let j in rawRoutes[ i ]) {
        let route = rawRoutes[ i ][ j ];

        if (method === 'all') {
          for (v in self.api.routes.verbs) {
            verb = self.api.routes.verbs[ v ];
            self.api.routes.registerRoute(verb, route.path, route.action, route.apiVersion, route.matchTrailingPathParts);
          }
        } else {
          api.routes.registerRoute(method, route.path, route.action, route.apiVersion, route.matchTrailingPathParts);
        }
        counter++;
      }
    }

    // todo - implement that
    // self.api.params.postVariables = Utils.arrayUniqueify(self.api.params.postVariables);

    self.api.log(`${counter} routes loaded from `, 'debug', self.api.routes.routesFile);

    if (self.api.config.servers.web && self.api.config.servers.web.simpleRouting === true) {
      let simplePaths = [];


      for (let action in self.api.actions.actions) {
        simplePaths.push(`/${action}`);
        for (v in self.api.routes.verbs) {
          verb = self.api.routes.verbs[ v ];
          self.registerRoute(verb, `/${action}`, action);
        }
      }

      self.api.log(`${simplePaths.length} simple routes loaded from action names`, 'debug');
      self.api.log('routes: ', 'debug', self.api.routes.routes);
    }
  }
}

/**
 * Initializer to load the class who process the routes requests.
 */
export default class {

  /**
   * This only can be loaded after the servers.
   *
   * @type {number}
   */
  static loadPriority = 25;

  static load(api, next) {
    // put the routes manager available to all platform
    api.routes = new RoutesManager(api);

    // load all routes
    api.routes.loadRoutes();

    next();
  }

}
