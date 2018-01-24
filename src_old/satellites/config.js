import fs from 'fs'
import path from 'path'

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
    // if (argv.NODE_ENV) {
    //   this.api.env = argv.NODE_ENV
    // } else
    if (process.env.NODE_ENV) {
      this.api.env = process.env.NODE_ENV
    } else {
      this.api.env = 'development'
    }
  }

  /**
   * Unwatch all files.
   */
  unwatchAllFiles () {
    // iterate all watched files and say to the FS to stop watch the changes
    this._watchedFiles.forEach(file => { fs.unwatchFile(file) })

    // reset the watch array
    this._watchedFiles = []
  }

  /**
   * Start watching for changes on a file and set a function to be executed
   * on the file change.
   *
   * @param file      File path
   * @param callback  Callback function.
   */
  watchFileAndAct (file, callback) {
    // normalise file path
    file = path.normalize(file)

    // check if file exists
    if (!fs.existsSync(file)) { throw new Error(`${file} does not exist, and cannot be watched`) }

    // the watch for files change only works on development mode
    if (this.api.config.general.developmentMode !== true || this._watchedFiles.indexOf(file) > 0) { return }

    // push the new file to the array of watched files
    this._watchedFiles.push(file)

    // say to the FS to start watching for changes in this file with an interval of 1 seconds
    fs.watchFile(file, { interval: 1000 }, (curr, prev) => {
      if (curr.mtime > prev.mtime && this.api.config.general.developmentMode === true) {
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
    this.api.log(`\r\n\r\n*** rebooting due to config change (${file}) ***\r\n\r\n`, 'info')
    delete require.cache[ require.resolve(file) ]
    this.api.commands.restart.call(this.api._self)
  }

  _loadConfigs () {
    // set config object on API
    this.api.config = {}

    // we don't start watching for file changes on state0
    const isToWatch = this.api.status === 'init_stage0'

    try {
      // read project manifest
      this.api.config = require(`${this.api.scope.rootPath}/manifest.json`)
    } catch (e) {
      // when the project manifest doesn't exists the user is informed
      // and the engine instance is terminated
      this.api.log('Project `manifest.json` file does not exists.', 'emergency')

      // finish process (we can not stop the Engine because it can not be run)
      process.exit(1)
    }

    // load the default config files from the Stellar core
    this.loadConfigDirectory(`${__dirname}/../config`, false)

    // load all the configs from the modules
    this.api.config.modules.forEach(moduleName => this.loadConfigDirectory(`${this.api.scope.rootPath}/modules/${moduleName}/config`, isToWatch))

    // load the config files from the current universe if exists the platform
    // should be reloaded when the project configs changes
    this.loadConfigDirectory(`${this.api.scope.rootPath}/config`, isToWatch)
  }

}
