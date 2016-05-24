import Utils from '../utils'

/**
 * This initializer loads all active modules configs to the
 * engine instance.
 */
export default class {

  /**
   * Initializer load priority.
   *
   * @type {number}
   */
  static loadPriority = 0

  /**
   * Initializer load function.
   *
   * @param api   API reference.
   * @param next  Callback function.
   */
  static load (api, next) {
    // get active modules
    let modules = api.config.modules

    // this config is required. If doesn't exists or is an empty array
    // an exception should be raised.
    if (modules === undefined || modules.length === 0) { api.shutdown(true, 'At least one module needs to be active.') }

    // save the list of active modules
    api.config.activeModules = Utils.objClone(api.config.modules)

    // save the modules
    api.config.modules = new Map()

    // create  anew object to save the modules full path
    api.config.modulesPaths = new Map()

    // load all modules manifests
    api.config.activeModules.forEach((moduleName) => {
      // build the full path
      let path = `${api.scope.rootPath}/modules/${moduleName}`

      // get module manifest file content
      let manifest = require(`${path}/manifest.json`)

      // save the module config on the engine instance
      api.config.modules.set(manifest.id, manifest)

      // save the module full path
      api.config.modulesPaths.set(manifest.id, path)
    })

    // finish initializer loading
    next();
  }

}
