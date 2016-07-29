'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _utils = require('../utils');

var _utils2 = _interopRequireDefault(_utils);

var _child_process = require('child_process');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * This class is responsible to manage all modules, process
 * the NPM dependencies.
 */

var Modules = function () {

  /**
   * Create a new class instance.
   *
   * @param api
   */


  /**
   * Map with the active modules.
   *
   * Keys are the modules slugs and the values are
   * their manifests.
   *
   * @type {Map}
   */

  function Modules(api) {
    _classCallCheck(this, Modules);

    this.api = null;
    this.activeModules = new Map();
    this.modulesPaths = new Map();
    this.api = api;
  }

  /**
   * Load all active modules into memory.
   *
   * The private module is always loaded even if not present on the
   * activeModules property.
   */


  /**
   * Map with the modules paths.
   *
   * @type {Map}
   */


  /**
   * API reference object.
   *
   * @type {null}
   */


  _createClass(Modules, [{
    key: 'loadModules',
    value: function loadModules() {
      var self = this;

      // get active modules
      var modules = self.api.config.modules;

      // check if the private module folder exists
      if (_utils2.default.directoryExists(self.api.scope.rootPath + '/modules/private')) {
        modules.push('private');
      }

      // this config is required. If doesn't exists or is an empty array
      // an exception should be raised.
      if (modules === undefined || modules.length === 0) {
        next(new Error('At least one module needs to be active.'));

        // engine don't finish the starting wet, soo we need to finish the process
        process.exit(1);
      }

      // load all modules manifests
      modules.forEach(function (moduleName) {
        // build the full path
        var path = self.api.scope.rootPath + '/modules/' + moduleName;

        // get module manifest file content
        var manifest = require(path + '/manifest.json');

        // save the module config on the engine instance
        self.activeModules.set(manifest.id, manifest);

        // save the module full path
        self.modulesPaths.set(manifest.id, path);
      });
    }

    /**
     * Process all NPM dependencies.
     *
     * The npm install command only is executed if the package.json
     * file are not present.
     *
     * @param next    Callback function.
     */

  }, {
    key: 'processNpmDependencies',
    value: function processNpmDependencies(next) {
      var self = this;

      // if the `package.json` file already exists don't search for NPM dependencies
      if (_utils2.default.fileExists(self.api.scope.rootPath + '/package.json')) {
        return next();
      }

      // global npm dependencies
      var npmDependencies = {};

      // iterate all active modules
      self.activeModules.forEach(function (manifest) {
        // check if the module have NPM dependencies
        if (manifest.npmDependencies !== undefined) {
          // merge the two hashes
          npmDependencies = _utils2.default.hashMerge(npmDependencies, manifest.npmDependencies);
        }
      });

      // compile project information
      var projectJson = {
        private: true,
        name: 'stellar-dependencies',
        version: '1.0.0',
        description: 'This is automatically generated don\'t edit',
        dependencies: npmDependencies
      };

      // generate project.json file
      _fs2.default.writeFileSync(self.api.scope.rootPath + '/package.json', JSON.stringify(projectJson, null, 2), 'utf8');

      self.api.log('updating NPM packages', 'info');

      // run npm command
      (0, _child_process.exec)('npm install', function (error) {
        // if an error occurs finish the process
        if (error) {
          self.api.log('An error occurs during the NPM install command', 'emergency');
          process.exit(1);
        }

        // load a success message
        self.api.log('NPM dependencies updated!', 'info');

        // finish the loading process
        next();
      });
    }
  }]);

  return Modules;
}();

/**
 * This initializer loads all active modules configs to the
 * engine instance.
 */


var _class = function () {
  function _class() {
    _classCallCheck(this, _class);

    this.loadPriority = 1;
  }

  /**
   * Initializer load priority.
   *
   * @type {number}
   */


  _createClass(_class, [{
    key: 'load',


    /**
     * Initializer load function.
     *
     * @param api   API reference.
     * @param next  Callback function.
     */
    value: function load(api, next) {
      // instantiate the manager
      api.modules = new Modules(api);

      // load modules into memory
      api.modules.loadModules();

      // process NPM dependencies
      api.modules.processNpmDependencies(next);
    }
  }]);

  return _class;
}();

exports.default = _class;
//# sourceMappingURL=modules.js.map
