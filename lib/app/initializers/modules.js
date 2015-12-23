/**
 * Modules dependencies.
 */

var filesystem  = require('fs');
var Utils       = require('../utils');
var _           = require('lodash');

module.exports = {

  loadPriority: 0,

  load: function (api, next) {
    // ---------------------------------------------------
    // load all modules located on the `modules` folder
    // ---------------------------------------------------

    // get all modules folders
    var modules_folders = Utils.getFolders(api.scope.rootPath + '/modules');

    // iterate all folders
    _.forEach(modules_folders, function (module_path) {
      // check if manifest exists
      var manifest = JSON.parse(filesystem.readFileSync(module_path + '/manifest.json', 'utf8'));

      // get module id
      var module_id = manifest.id;

      // ---------------------------------------------------
      // register all actions
      //
      // todo: this should be moved to another initializer for
      // that effect
      // ---------------------------------------------------

      // get all actions files
      var action_files = Utils.getFiles(module_path + '/actions');

      // iterate all actions files
      _.forEach(action_files, function (action_path) {
        // get action object
        var action = require(action_path);

        // register new action on engine
        // @todo move it to a new initializer
        //api.registerAction(action);
      });

      next();
    });
  }

};
