// initializer modules
import _ from 'lodash';
import Utils from '../utils';

/**
 * This class manage all actions.
 */
class Actions {

  /**
   * API reference.
   *
   * @type {null}
   */
  api = null;

  /**
   * Hash map with the registered actions.
   *
   * @type {{}}
   */
  actions = {};

  versions = {};

  constructor(api) {
    this.api = api;
  }

  loadFile(fullFilePath) {
    let self = this;

    // load action file
    let collection = require(fullFilePath);

    // check if the content is an array of an object
    if (!_.isArray(collection)) {
      collection = [collection];
    }

    _.forEach(collection, function (action) {
      self.actions[action.name] = action;

      // debug message
      self.api.log(`action loaded: ${action.name}, ${fullFilePath}`, 'debug');
    });
  }

}

// initializer class
export default class {

  static loadPriority = 1;

  static load(api, next) {
    // add the actions class to the api
    api.actions = new Actions(api);

    // iterate all modules and load all actions
    _.forEach(api.config.modules, function (module_slug, manifest) {
      _.forEach(Utils.getFiles(`${api.scope.rootPath}/modules/${module_slug}/actions`), function (file) {
        api.actions.loadFile(file);
      });
    });

    next();
  }

}
