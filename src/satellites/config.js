import fs from 'fs'
import path from 'path'
import Utils from '../utils'

class ConfigManager {

  /**
   * Api reference object.
   *
   * @type {null}
   */
  api = null

  /**
   * Files to watch for changes.
   *
   * @type {Array}
   * @private
   */
  _watchedFiles = []

  /**
   * Create a new instance of the ConfigManager.
   *
   * @param api API reference object.
   */
  constructor (api) { this.api = api }

  /**
   * Start the config execution.
   */
  execute (next) {
    // init the execution environment
    this._setupEnvironment()

    // creates 'temp' folder if it does not exist
    this._createTempFolder()

    // load manifest file, and core, project and modules configs
    this._loadConfigs()

    // finish the config execution on the next tick
    process.nextTick(next)
  }

  /**
   * Setup the execution  environment.
   *
   * This define what environment should be used.
   *
   * TODO: use the command line arguments to define the environment
   */
  _setupEnvironment () {
    let self = this

    // if (argv.NODE_ENV) {
    //   self.api.env = argv.NODE_ENV
    // } else
    if (process.env.NODE_ENV) {
      self.api.env = process.env.NODE_ENV
    } else {
      self.api.env = 'development'
    }
  }

  /**
   * Unwatch all files.
   */
  unwatchAllFiles () {
    let self = this

    // iterate all watched files and say to the FS to stop watch the changes
    for (let i in self._watchedFiles) {
      fs.unwatchFile(self._watchedFiles[ i ])
    }

    // reset the watch array
    self._watchedFiles = []
  }

  /**
   * Start watching for changes on a file and set a function to be executed
   * on the file change.
   *
   * @param file      File path
   * @param callback  Callback function.
   */
  watchFileAndAct (file, callback) {
    let self = this

    // normalise file path
    file = path.normalize(file)

    // check if file exists
    if (!fs.existsSync(file)) { throw new Error(`${file} does not exist, and cannot be watched`) }

    // the watch for files change only works on development mode
    if (self.api.config.general.developmentMode !== true || self._watchedFiles.indexOf(file) > 0) { return }

    // push the new file to the array of watched files
    self._watchedFiles.push(file)

    // say to the FS to start watching for changes in this file with an interval of 1 seconds
    fs.watchFile(file, { interval: 1000 }, (curr, prev) => {
      if (curr.mtime > prev.mtime && self.api.config.general.developmentMode === true) {
        process.nextTick(() => {
          let cleanPath = file

          // we need to replace the '/' by '\'
          if (process.platform === 'win32') { cleanPath = file.replace(/\//g, '\\') }

          // remove file from require cache to force reload the file
          delete require.cache[ require.resolve(cleanPath) ]

          // execute the callback function
          callback(file)
        })
      }
    })
  }

  /**
   * Reboot handler.
   *
   * This is executed when a config file is changed.
   *
   * @param file  File path who as changed.
   * @private
   */
  _rebootCallback (file) {
    let self = this

    self.api.log(`\r\n\r\n*** rebooting due to config change (${file}) ***\r\n\r\n`, 'info')
    delete require.cache[ require.resolve(file) ]
    self.api.commands.restart.call(self.api._self)
  }

  _loadConfigs () {
    let self = this

    // set config object on API
    self.api.config = {}

    try {
      // read project manifest
      self.api.config = require(`${self.api.scope.rootPath}/manifest.json`)
    } catch (e) {
      // when the project manifest doesn't exists the user is informed
      // and the engine instance is terminated
      self.api.log('Project `manifest.json` file does not exists.', 'emergency')

      // finish process (we can not stop the Engine because it can not be run)
      process.exit(1)
    }

    // load the default config files from the Stellar core
    self.loadConfigDirectory(__dirname + '/../config')

    // load all the configs from the modules
    self.api.config.modules.forEach(moduleName => self.loadConfigDirectory(`${self.api.scope.rootPath}/modules/${moduleName}/config`, true))

    // load the config files from the current universe if exists
    // the platform should be reloaded when the project configs changes
    self.loadConfigDirectory(`${self.api.scope.rootPath}/config`, true)
  }

  /**
   * Load a directory as a config repository.
   *
   * @param configPath
   * @param watch
   */
  loadConfigDirectory (configPath, watch = false) {
    let self = this

    // get all files from the config folder
    let configFiles = Utils.recursiveDirectoryGlob(configPath)

    let loadRetries = 0
    let loadErrors = {}

    for (let i = 0, limit = configFiles.length; (i < limit); i++) {
      // get the next file to be loaded
      let file = configFiles[ i ]

      try {
        // attempt configuration file load
        let localConfig = require(file)
        if (localConfig.default) { self.api.config = Utils.hashMerge(self.api.config, localConfig.default, self.api) }
        if (localConfig[ self.api.env ]) { self.api.config = Utils.hashMerge(self.api.config, localConfig[ self.api.env ], self.api) }

        // configuration file load success: clear retries and errors since progress
        // has been made
        loadRetries = 0
        loadErrors = {}

        // configuration file loaded: set watch
        if (watch !== false) { self.watchFileAndAct(file, self._rebootCallback.bind(self)) }
      } catch (error) {
        // error loading configuration, abort if all remaining configuration files
        // have been tried and failed indicating inability to progress
        loadErrors[ file ] = error.toString()
        if (++loadRetries === limit - i) {
          throw new Error('Unable to load configurations, errors: ' + JSON.stringify(loadErrors))
        }
        // adjust configuration files list: remove and push failed configuration to
        // the end of the list and continue with next file at same index
        configFiles.push(configFiles.splice(i--, 1)[ 0 ])
      }
    }
  }

  /**
   * Creates the 'temp' folder if it does not exist.
   *
   * This folder is used to store the log files.
   *
   * @private
   */
  _createTempFolder () {
    let self = this

    if (!Utils.directoryExists(`${self.api.scope.rootPath}/temp`)) {
      Utils.createFolder(`${self.api.scope.rootPath}/temp`)
    }
  }
}

/**
 * This initializer loads all app configs to the current running instance.
 */
export default class {

  /**
   * Load priority.
   *
   * This initializer needs to be loaded first of all
   * others.
   *
   * @type {number}
   */
  loadPriority = 0

  /**
   * Load satellite function.
   *
   * @param api   API object reference.
   * @param next  Callback function.
   */
  load (api, next) {
    // put the config instance available on the API object
    api.configs = new ConfigManager(api)

    // start the config manager execution
    api.configs.execute(next)
  }

  /**
   * Start satellite function.
   *
   * @param api   Api object reference.
   * @param next  Callback function.
   */
  start (api, next) {
    // print out the current environment
    api.log(`environment: ${api.env}`, 'notice')

    // finish the satellite start
    next()
  }

}
