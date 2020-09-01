import _async from 'async'
import Waterline from 'waterline'
import path, {basename} from 'path'
import { promisify } from "util";

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
    const adapters = this.processAdapters();
    const datastores = this.api.config.models.datastores;
    const models = await this.loadModels();

    const ormStart = promisify(Waterline.start);

    this.waterline = await ormStart({
      adapters,
      datastores,
      models,
    })
  }

  /**
   * Finish the model system.
   */
  async finish () {
    const waterlineStop = promisify(Waterline.stop);
    await waterlineStop(this.waterline);
  }

  /**
   * Preprocess the model.
   * 
   * @param modelName model base name
   * @param modelOrig original model object
   */
  async preProcessModelData(modelName, modelOrig) {
    // The model definition can be a function, whether it happens we need pass
    // the api reference.
    if (typeof modelOrig === "function") {
      modelOrig = modelOrig(this.api);
    }

    // Execute the `add` event to allow other modules modify this model before it
    // gets compiled.
    const { model } = await this.api.events.fire(
      `core.models.add.${modelName}`,
      {
        model: modelOrig,
      },
    );

    // When there is no identity property defined we use the file basename.
    if (!model.identity) {
      model.identity = modelName;
    }

    if (!model.datastore) {
      model.datastore = this.api.config.models.defaultDatastore;
    }

    if (!model.schema) {
      model.schema = this.api.config.models.schema;
    }

    // when there is no primary key set we inject an id field and mark it as 
    // primary
    if (!model.primaryKey) {
      if (!model.attributes.id) {
        model.attributes.id = {
          type: 'number',
          autoMigrations: { autoIncrement: true }
        }
      }

      model.primaryKey = 'id'
    }

    return model;
  }

  /**
   * Load all models into the memory and preprocess them ot see if is valid 
   * data.
   * 
   * @param models array of modules to be loaded
   */
  async processModelsFiles(models) {
    const result = []

    for (const modelFile of models) {
      const modelBasename = basename(modelFile, '.js')
      this._watchForChanges(modelFile)

      try {
        const model = await this.preProcessModelData(modelBasename, require(modelFile).default)
        result.push(model)

        this.api.log(`Model loaded: ${modelBasename}`, 'debug')
      } catch(error) {
        this.api.log(`Model error (${modelBasename}): ${error.message}`, 'error', error)
      }
    }

    return result
  }

  /**
   * Load models from the modules.
   */
  async loadModels () {
    let allModels = [];

    for (const [_, modulePath] of this.api.modules.modulesPaths) {
      const modelFiles = this.api.utils.recursiveDirectoryGlob(`${modulePath}/models`);
      const processedModels = await this.processModelsFiles(modelFiles);
      allModels = [...allModels, ...processedModels];
    }

    return allModels.reduce((result, model) => ({...result, [model.identity]: model}), ({}))
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
  get (modelName) { 
    return Waterline.getModel(modelName, this.waterline); 
  }

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
      if (!this.api.utils.hasProp(key, this.api.config.models.adapters)) {
        continue;
      }

      // get module name
      const moduleName = this.api.config.models.adapters[ key ]

      // when we are restarting the server this already was replaced with the
      // module, so we ignore it
      if (typeof moduleName !== 'string') { continue }

      // replace the static value with the module instance
      this.api.config.models.adapters[ key ] = this.api.utils.require(moduleName)

      // force all adapters to use the key specific by the user.
      this.api.config.models.adapters[key].identity = key;
    }

    return this.api.config.models.adapters;
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
    api.models.createNewInstance().then(next)
  }

  /**
   * Initializer stop function.
   *
   * @param api   API reference.
   * @param next  Callback function.
   */
  stop (api, next) {
    api.models.finish().then(next)
  }
}
