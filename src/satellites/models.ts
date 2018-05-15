import { basename } from 'path';
import { promisify } from 'util';

import * as Waterline from 'waterline';

import { Satellite } from '../satellite';
import { LogLevel } from '../log-level.enum';
import ModelInterface from '../model.interface';

/**
 * Custom type for generator models.
 */
type ModelGenerator = (api: any) => ModelInterface;

export default class ModelsSatellite extends Satellite {
  protected _name: string = 'models';
  public loadPriority: number = 100;
  public startPriority: number = 100;
  public stopPriority: number = 400;

  /**
   * Waterline instance.
   */
  public waterline: Waterline;

  /**
   * Object with the Waterline Ontology.
   */
  private ontology;

  /**
   * Waterline ORM instance.
   */
  private orm;

  /**
   * Add a new modal.
   *
   * @param name Modal name.
   * @param model Modal instance.
   */
  public async add(name: string, model: ModelInterface | any): Promise<void> {
    // The model definition can be a function, whether it happens we need pass
    // the api reference.
    if (typeof model === 'function') {
      model = model(this.api) as ModelInterface;
    }

    // Execute the `add` event to allow other modules modify this model before it
    // gets compiled.
    const response = await this.api.events.fire(`core.models.add.${name}`, {
      model,
    });

    // When there is no identity property defined we use the file basename.
    if (!response.model.identity) {
      response.model.identity = name;
    }

    // if there is no connection set we use the default connection
    if (!response.model.connection) {
      response.model.connection = this.api.configs.models.defaultConnection;
    }

    // if there is a no schema property on set the model, we use the the default
    // configuration
    if (!response.model.schema) {
      response.model.schema = this.api.config.models.schema;
    }

    // create a Waterline collection
    const collection = Waterline.Collection.extend(response.model);

    // load the connection into the waterline instance
    this.waterline.loadCollection(collection);
  }

  public get(modelName: string): any {
    return Waterline.getModel(modelName, this.orm);
  }

  /**
   * I the development mode is active the file must be watched for changes.
   *
   * When the file changes we following tasks must be performed:
   *  - log a message
   *  - remove the file cache from require
   *  - reload Stellar
   *
   * @param path Path for the model file to be watched.
   */
  private watchForChanges(path: string) {
    if (!this.api.configs.general.developmentMode) {
      return;
    }

    this.api.config.watchFileAndAct(path, () => {
      this.api.log(
        `\r\n\r\n*** rebooting due to model change (${path}) ***\r\n\r\n`,
        LogLevel.Info,
      );
      delete require.cache[require.resolve(path)];
      this.api.commands.restart();
    });
  }

  /**
   * Preprocess the model.
   *
   * @param modelName Model basename.
   * @param modelOrig Original model object.
   */
  private async preProcessModelData(
    modelName: string,
    modelOrig: ModelInterface | ModelGenerator,
  ): Promise<ModelInterface> {
    // The model definition can be a function, whether it happens we need pass
    // the api reference.
    if (typeof modelOrig === 'function') {
      modelOrig = modelOrig(this.api) as ModelInterface;
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
      model.datastore = this.api.configs.models.defaultDatastore;
    }

    if (!model.schema) {
      model.schema = this.api.configs.models.schema;
    }

    return model;
  }

  /**
   * Load all models into the memory and preprocess them to see
   * is valid data.
   *
   * @param models Array of models to be loaded.
   */
  private async processModelsFiles(
    models: Array<string>,
  ): Promise<Array<ModelInterface>> {
    const result = [];

    for (const modelFile of models) {
      const modelBasename = basename(modelFile, '.js');
      this.watchForChanges(modelFile);

      try {
        const model = await this.preProcessModelData(
          modelBasename,
          require(modelFile).default,
        );
        result.push(model);

        this.api.log(`Model loaded: ${modelBasename}`, LogLevel.Debug);
      } catch (error) {
        this.api.log(
          `Model error (${modelBasename}): ${error.message}`,
          LogLevel.Error,
          error,
        );
      }
    }

    return result;
  }

  /**
   * Model all modules into memory.
   */
  private async loadModels(): Promise<any> {
    let allModels = [];

    for (const [_, modulePath] of this.api.modules.modulesPaths) {
      const modelsFiles = this.api.utils.recursiveDirSearch(
        `${modulePath}/models`,
      );
      const moduleModels = await this.processModelsFiles(modelsFiles);
      allModels = allModels.concat(moduleModels);
    }

    const resultObj = {};
    allModels.forEach((model: ModelInterface) => {
      resultObj[model.identity] = model;
    });

    return resultObj;
  }

  /**
   * Process the adapters.
   */
  private processAdapters(): any {
    for (const key in this.api.configs.models.adapters) {
      if (!this.api.configs.models.adapters.hasOwnProperty(key)) {
        continue;
      }

      const moduleName = this.api.configs.models.adapters[key];

      // When the server is restarting this already was replaced with the
      // module, so we ignore it.
      if (typeof moduleName !== 'string') {
        continue;
      }

      // Replace the static value with the module instance
      this.api.configs.models.adapters[key] = this.api.utils.require(
        moduleName,
      );

      // Force all adapters to use the key specific by the user.
      this.api.configs.models.adapters[key].identity = key;
    }

    return this.api.configs.models.adapters;
  }

  public async load(): Promise<void> {
    this.api.models = this;
  }

  public async start(): Promise<void> {
    const ormStart = promisify(Waterline.start);

    this.orm = await ormStart({
      adapters: this.processAdapters(),
      datastores: this.api.configs.models.datastores,
      models: await this.loadModels(),
    });
  }

  public async stop(): Promise<void> {
    const stop = promisify(Waterline.stop);
    await stop(this.waterline);
  }
}
