/**
 * Modules dependencies.
 */

var filesystem  = require('fs');
var Utils       = require('./utils');
var _           = require('lodash');

/**
 * Modules manager.
 *
 * @param {Stellar} engine Stellar engine instance.
 */
function Modules(engine) {

  /**
   * Engine instance.
   *
   * @type {Stellar}
   */
  this.engine = engine;

  /**
   * List with loaded modules.
   *
   * @type {Object}
   */
  this.modules = {};

  /**
   * Modules paths.
   *
   * @type {Object}
   */
  this.modulePaths = {};

  // -------------------------------------------------------------------------- [PRIVATE]

  var loadModuleActions = function (module_id, module_path) {
    var self = this;

    // get all actions files path
    var action_files = Utils.getFiles(module_path + '/actions');

    // iterate all actions files
    _.forEach(action_files, function (action_path) {
      // get action object
      var action = require(action_path);

      // register new action on engine
      self.engine.registerAction(action);
    });
  };

  // -------------------------------------------------------------------------- [PUBLIC]

  /**
   * Read modules information.
   */
  this.readModules = function () {
    var self = this;

    // get all modules folders
    var moduleFolders = Utils.getFolders(this.engine.scope.rootPath + '/modules');

    // iterate all modules
    _.forEach(moduleFolders, function (moduleFolder) {

      // check if manifest exists
      var manifest = JSON.parse(filesystem.readFileSync(moduleFolder + '/manifest.json', 'utf8'));

      // insert the module on the modules list
      self.modules[manifest.id] = manifest;

      // sava modules path
      self.modulePaths[manifest.id] = moduleFolder;
    });
  };

  /**
   * Load modules componentes (actions, tasks, ...).
   */
  this.loadModules = function () {
    var self = this;

    // iterate all modules
    _.forEach(this.modules, function (manifest, module_id) {
      // register all actions
      loadModuleActions.call(self, module_id, self.modulePaths[module_id]);

      // debug info
      self.engine.log.debug(('Module "' + module_id + '" loaded.').white);
    });
  };

}

// export module
module.exports = Modules;
