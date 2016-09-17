'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _utils = require('../utils');

var _utils2 = _interopRequireDefault(_utils);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Class to manage the HTTP action routes.
 */
var RoutesManager = function () {

  /**
   * Create a new RoutesManager instance.
   *
   * @param api API reference.
   */


  /**
   * Map with the registered routes.
   *
   * @type {{}}
   */
  function RoutesManager(api) {
    _classCallCheck(this, RoutesManager);

    this.api = null;
    this.routes = { 'get': [], 'post': [], 'put': [], 'patch': [], 'delete': [] };
    this.verbs = ['get', 'post', 'put', 'patch', 'delete'];

    var self = this;

    // save the API object reference
    self.api = api;
  }

  /**
   * Process a route call.
   *
   * @param connection    Connection object.
   * @param pathParts     URI parts.
   */


  /**
   * Available verbs.
   *
   * @type {string[]}
   */


  /**
   * API reference.
   *
   * @type {null}
   */


  _createClass(RoutesManager, [{
    key: 'processRoute',
    value: function processRoute(connection, pathParts) {
      var self = this;

      // check if the connection contains an action and that action are defined on the current context
      if (connection.params.action === undefined || self.api.actions.actions[connection.params.action] === undefined) {
        // get HTTP request method
        var method = connection.rawConnection.method.toLowerCase();

        // if its a 'head' request change it to a 'get'
        if (method === 'head' && !self.routes.head) {
          method = 'get';
        }

        // iterate all registered routes
        for (var i in self.routes[method]) {
          var route = self.routes[method][i];

          // check if exists an URL match
          var match = self.matchURL(pathParts, route.path, route.matchTrailingPathParts);

          if (match.match === true) {
            if (route.apiVersion) {
              connection.params.apiVersion = connection.param.apiVersion || route.apiVersion;
            }

            // decode URL params
            for (var param in match.params) {
              try {
                var decodedName = decodeURIComponent(param.replace(/\+/g, ' '));
                var decodedValue = decodeURIComponent(match.params[param].replace(/\+g/, ' '));
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

  }, {
    key: 'matchURL',
    value: function matchURL(pathParts, match, matchTrailingPathParts) {
      var response = { match: false, params: {} };
      var matchParts = match.split('/');
      var regexp = '';
      var variable = '';

      if (matchParts[0] === '') {
        matchParts.splice(0, 1);
      }

      if (matchParts[matchParts.length - 1 === '']) {
        matchParts.pop();
      }

      if (matchParts.length !== pathParts.length && matchTrailingPathParts !== true) {
        return response;
      }

      for (var i in matchParts) {
        var matchPart = matchParts[i];
        var pathPart = pathParts[i];

        if (matchTrailingPathParts === true && parseInt(i) === matchPart.len - 1) {
          for (var j in pathParts) {
            if (j > i) {
              pathPart = pathPart + '/' + pathParts[j];
            }
          }
        }

        if (!pathPart) {
          return response;
        } else if (matchPart[0] === ':' && matchPart.indexOf('(') < 0) {
          variable = matchPart.replace(':', '');
          response.params[variable] = pathPart;
        } else if (matchPart[0] === ':' && matchPart.indexOf('(') >= 0) {
          variable = matchPart.replace(':', '').split('(')[0];
          regexp = matchPart.substring(matchPart.indexOf('(') + 1, matchPart.length - 1);
          var matches = pathPart.match(new RegExp(regexp, 'g'));
          if (matches) {
            response.params[variable] = pathPart;
          } else {
            return response;
          }
        } else {
          if (pathPart === null || pathPart === undefined || pathParts[i].toLowerCase() !== matchPart.toLowerCase()) {
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

  }, {
    key: 'registerRoute',
    value: function registerRoute(method, path, action, apiVersion) {
      var matchTrailingPathParts = arguments.length <= 4 || arguments[4] === undefined ? false : arguments[4];

      var self = this;

      self.routes[method].push({
        path: path,
        matchTrailingPathParts: matchTrailingPathParts,
        action: action,
        apiVersion: apiVersion
      });
    }

    /**
     * Load routes.
     *
     * @param rawRoutes
     */

  }, {
    key: 'loadRoutes',
    value: function loadRoutes(rawRoutes) {
      var self = this;
      var counter = 0;

      // iterate all objects
      for (var i in rawRoutes) {
        // get http method in lower case
        var method = i.toLowerCase();

        var _loop = function _loop(j) {
          var route = rawRoutes[i][j];

          if (method === 'all') {
            // iterate all http methods
            self.api.routes.verbs.forEach(function (verb) {
              self.api.routes.registerRoute(verb, route.path, route.action, route.apiVersion, route.matchTrailingPathParts);
            });
          } else {
            self.api.routes.registerRoute(method, route.path, route.action, route.apiVersion, route.matchTrailingPathParts);
          }
          counter++;
        };

        for (var j in rawRoutes[i]) {
          _loop(j);
        }
      }

      // remove duplicated entries on postVariables
      self.api.params.postVariables = _utils2.default.arrayUniqueify(self.api.params.postVariables);

      // log the number of loaded routes
      self.api.log(counter + ' routes loaded', 'debug');

      if (self.api.config.servers.web && self.api.config.servers.web.simpleRouting === true) {
        var simplePaths = [];

        // iterate all registered actions

        var _loop2 = function _loop2(action) {
          // push the action name to the simples paths
          simplePaths.push('/' + action);

          // iterate all verbs
          self.verbs.forEach(function (verb) {
            self.registerRoute(verb, '/' + action, action);
          });
        };

        for (var action in self.api.actions.actions) {
          _loop2(action);
        }

        // log the number of simple routes loaded
        self.api.log(simplePaths.length + ' simple routes loaded from action names', 'debug');
        self.api.log('routes: ', 'debug', self.routes);
      }
    }

    /**
     * Load all modules route files.
     *
     * If the modules have the 'routes.js' file on the module root
     * folder we load that file.
     */

  }, {
    key: 'loadModulesRoutes',
    value: function loadModulesRoutes() {
      var self = this;

      // iterate all active modules
      self.api.modules.modulesPaths.forEach(function (modulePath) {
        try {
          // build the file path
          var path = modulePath + '/routes.json';

          // check if the module have a 'routes.js' file
          _fs2.default.accessSync(path, _fs2.default.F_OK);

          // load the routes on the engine
          self.loadRoutes(require(path));
        } catch (e) {
          // do nothing
        }
      });

      // check if we have some routes on the config object
      if (self.api.config.routes) {
        self.loadRoutes(self.api.config.routes);
      }
    }
  }]);

  return RoutesManager;
}();

/**
 * Initializer to load the class who process the routes requests.
 */


var _class = function () {
  function _class() {
    _classCallCheck(this, _class);

    this.loadPriority = 500;
  }

  /**
   * Initializer load priority.
   *
   * This only can be loaded after the servers.
   *
   * @type {number}
   */


  _createClass(_class, [{
    key: 'load',


    /**
     * Initializer loading function.
     *
     * @param api   API reference.
     * @param next  Callback function.
     */
    value: function load(api, next) {
      // put the routes manager available to all platform
      api.routes = new RoutesManager(api);

      // load routes from the config file
      api.routes.loadModulesRoutes();

      // finish the initializer loading
      next();
    }
  }]);

  return _class;
}();

exports.default = _class;