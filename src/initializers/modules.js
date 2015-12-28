import _ from 'lodash';

/**
 * This initializer loads all active modules configs to the
 * engine instance.
 */
export default class Modules {

  static loadPriority = 0;

  static load(api, next) {
    // get active modules
    let modules = api.config.app.modules;

    // this config is required. If doesn't exists or is an empty array
    // an exception should be raised.
    if (modules === undefined || _.isEmpty(modules)) {
      api.shutdown(true, 'At least one module needs to be active.');
    }

    // the modules configs are located at `api.config.modules`
    api.config.modules = {};

    // load all modules manifests
    _.forEach(modules, function (module_slug) {
      let path = `${api.scope.rootPath}/modules/${module_slug}/manifest.json`;

      // get module manifest file content
      let manifest = require(path);

      // save the module config on the engine instance
      api.config.modules[manifest.id] = manifest;
    });

    next();
  }

}
