import _async from 'async'
import Waterline from 'waterline'
import path from 'path'

/**
 * Satellite to manage the models using Waterline ORM.
 *
 * Using Waterline allow us interact with different kinds of database systems.
 */
class Models {
  /**
   * Reference for the API object.
   *
   * @type null
   */
  api = null

  /**
   * Waterline instance.
   *
   * @type {[type]}
   */
  waterline = null

   /**
    * Object with the Waterline ontology.
    *
    * @type WaterlineOntology
    */
  ontology = null

  /**
   * Create a new class instance.
   *
   * @param api   API reference.
   */
  constructor (api) { this.api = api }

  /**
   * Create a new Waterline instance.
   */
  async createNewInstance () {
    this.waterline = new Waterline()
  }

  /**
   * Initialize the Waterline instance.
   *
   * @param callback  Callback function.
   */
  initialize (callback) {
    // initialize the Waterline system
    this.waterline.initialize(this.api.config.models, (error, ontology) => {
      // if an error occurred we need stop the execution
      if (error) { return callback(error) }

      // save the ontology for later
      this.ontology = ontology

      // yup, is just this! Now the models system is read to fly.
      callback()
    })
  }

  /**
   * Finish the model system.
   *
   * @param callback  Callback function.
   */
  finish (callback) {
    this.waterline.teardown(callback)
  }

  /**
   * Add a new model.
   *
   * @param name    Model name.
   * @param model   Model instance.
   */
  async add (name, model) {
    // the model definition can be a function, whether it happens we need pass
    // the api reference.
    if (typeof model === 'function') { model = model(this.api) }

    // execute the add event to allow other modules modify this model before it
    // gets compiled
    const response = await this.api.events.fire(`core.models.add.${name}`, { model })

    // when there is no identity property defined we use the file basename
    if (!response.model.identity) { response.model.identity = name }

    // if there is no connection set we use the default connection
    if (!response.model.connection) {
      response.model.connection = this.api.config.models.defaultConnection
    }

    // if there is a no schema property on set the model, we use the the default
    // configuration
    if (!response.model.schema) {
      response.model.schema = this.api.config.models.schema
    }

    // create a Waterline collection
    const collection = Waterline.Collection.extend(response.model)

    // load the connection into the waterline instance
    this.waterline.loadCollection(collection)
  }

  /**
   * Load models from the modules.
   */
  loadModels () {
    return new Promise(resolve => {
      const work = []

      // read models files from the modules
      this.api.modules.modulesPaths.forEach(modulePath => {
        this.api.utils.recursiveDirectoryGlob(`${modulePath}/models`)
          .forEach(moduleFile => {
            // get file basename
            let basename = path.basename(moduleFile, '.js')

            // start watching for changes on the model
            this._watchForChanges(moduleFile)

            // push a new work to the array
            work.push(callback => {
              this.add(basename, require(moduleFile).default)
              this.api.log(`model loaded: ${basename}`, 'debug')
              callback()
            })
          })
      })

      // process the all work and resolve the promise at the end
      _async.parallel(work, () => resolve())
    })
  }

  /**
   * If the development mode is active we must watch for changes.
   *
   * When the file changes we tack the following steps:
   *  - log a message
   *  - remove the file cache from require
   *  - reload Stellar
   */
  _watchForChanges (file) {
    // if the development mode is active we return
    if (!this.api.config.general.developmentMode) { return }

    // watch for changes on the model file
    this.api.configs.watchFileAndAct(file, () => {
      // log a information message
      this.api.log(`\r\n\r\n*** rebooting due to model change (${file}) ***\r\n\r\n`, 'info')

      // remove require cache
      delete require.cache[ require.resolve(file) ]

      // reload Stellar
      this.api.commands.restart.call(this.api._self)
    })
  }

  /**
   * Get a model object from the ontology.
   *
   * @param modelName                 Model name to get.
   * @returns {WaterlineCollection}   Model object.
   */
  get (modelName) { return this.ontology.collections[modelName] }

  /**
   * Remove a model from the repository.
   *
   * @param modelName   model name to be deleted.
   */
  remove (modelName) { this.models.delete(modelName) }

  /**
   * Process adapters.
   */
  processAdapters () {
    // iterate all adapters and require the right modules. We need to do this
    // here other wise the config system will break when the module isn't
    // installed
    for (const key in this.api.config.models.adapters) {
      // get module name
      const moduleName = this.api.config.models.adapters[key]

      // when we are restarting the server this already was replaced with the
      // module, so we ignore it
      if (typeof moduleName !== 'string') { continue }

      // replace the static value with the module instance
      this.api.config.models.adapters[key] = this.api.utils.require(moduleName)
    }
  }
}

/**
 * Initializer for the models features.
 */
export default class {
  /**
   * Initializer load priority.
   *
   * @type {number}
   */
  loadPriority = 100

  /**
   * Initializer start priority.
   *
   * @type {number}
   */
  startPriority = 100

  /**
   * Initializer stop priority.
   *
   * @type {number}
   */
  stopPriority = 400

  /**
   * Initializer loading function.
   *
   * @param api   API reference.
   * @param next  Callback function.
   */
  load (api, next) {
    // expose models class on the engine
    api.models = new Models(api)

    // finish the initializer loading
    next()
  }

  /**
   * Initializer start function.
   *
   * @param api   API reference.
   * @param next  Callback function.
   */
  start (api, next) {
    // load the models from the modules and then initialize the Waterline system
    api.models.createNewInstance()
      .then(_ => { api.models.loadModels() })
      .then(_ => { api.models.processAdapters() })
      .then(_ => { api.models.initialize(next) })
  }

  /**
   * Initializer stop function.
   *
   * @param api   API reference.
   * @param next  Callback function.
   */
  stop (api, next) {
    // close connection
    api.models.finish(next)
  }
}
