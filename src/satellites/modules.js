import fs from 'fs'
import Utils from '../utils'
import { exec } from 'child_process'

/**
 * This class is responsible to manage all modules, process
 * the NPM dependencies.
 */
class Modules {

  /**
   * API reference object.
   *
   * @type {null}
   */
  api = null

  /**
   * Create a new class instance.
   *
   * @param api
   */
  constructor (api) { this.api = api }

  /**
   * Load all active modules into memory.
   *
   * The private module is always loaded even if not present on the
   * activeModules property.
   */
  loadModules () {
    let self = this

    // get active modules
    let modules = self.api.config.modules

    // check if the private module folder exists
    if (Utils.directoryExists(`${self.api.scope.rootPath}/modules/private`)) { modules.push('private') }

    // this config is required. If doesn't exists or is an empty array
    // an exception should be raised.
    if (modules === undefined || modules.length === 0) {
      next(new Error('At least one module needs to be active.'))

      // engine don't finish the starting wet, soo we need to finish the process
      process.exit(1)
    }

    // save the list of active modules
    self.api.config.activeModules = Utils.objClone(self.api.config.modules)

    // save the modules
    self.api.config.modules = new Map()

    // create  anew object to save the modules full path
    self.api.config.modulesPaths = new Map()

    // load all modules manifests
    self.api.config.activeModules.forEach(moduleName => {
      // build the full path
      let path = `${self.api.scope.rootPath}/modules/${moduleName}`

      // get module manifest file content
      let manifest = require(`${path}/manifest.json`)

      // save the module config on the engine instance
      self.api.config.modules.set(manifest.id, manifest)

      // save the module full path
      self.api.config.modulesPaths.set(manifest.id, path)
    })
  }

  /**
   * Process all NPM dependencies.
   *
   * The npm install command only is executed if the package.json
   * file are not present.
   *
   * @param next    Callback function.
   */
  processNpmDependencies (next) {
    let self = this

    // if the `package.json` file already exists don't search for NPM dependencies
    if (Utils.fileExists(`${self.api.scope.rootPath}/package.json`)) { return next() }

    // global npm dependencies
    let npmDependencies = {}

    // iterate all active modules
    self.api.config.modules.forEach(manifest => {
      // check if the module have NPM dependencies
      if (manifest.npmDependencies !== undefined) {
        // merge the two hashes
        npmDependencies = Utils.hashMerge(npmDependencies, manifest.npmDependencies)
      }
    })

    // compile project information
    let projectJson = {
      private: true,
      name: 'stellar-dependencies',
      version: '1.0.0',
      description: 'This is automatically generated don\'t edit',
      dependencies: npmDependencies
    }

    // generate project.json file
    fs.writeFileSync(`${self.api.scope.rootPath}/package.json`, JSON.stringify(projectJson, null, 2), 'utf8')

    self.api.log('updating NPM packages', 'info')

    // run npm command
    exec('npm install', error => {
      // if an error occurs finish the process
      if (error) {
        self.api.log('An error occurs during the NPM install command', 'emergency')
        process.exit(1)
      }

      // load a success message
      self.api.log('NPM dependencies updated!', 'info')

      // finish the loading process
      next()
    })
  }

}

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
  loadPriority = 0

  /**
   * Initializer load function.
   *
   * @param api   API reference.
   * @param next  Callback function.
   */
  load (api, next) {
    // instantiate the manager
    api.modules = new Modules(api)

    // load modules into memory
    api.modules.loadModules()

    // process NPM dependencies
    api.modules.processNpmDependencies(next)
  }

}
