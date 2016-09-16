import path from 'path'
import Utils from '../utils'
import mongoose from 'mongoose'

/**
 * Manage the models.
 */
class Models {

  /**
   * Reference for the API object.
   *
   * @type {null}
   */
  api = null

  /**
   * Mongoose object.
   *
   * @type {null}
   */
  mongoose = null

  /**
   * Connection status.
   *
   * @type {boolean}
   */
  connected = false

  /**
   * Hash with all registered models.
   *
   * @type {Map}
   */
  models = new Map()

  /**
   * Create a new Models call instance.
   *
   * @param api   API reference.
   */
  constructor (api) {
    this.api = api
  }

  /**
   * Open connection to MongoDB server.
   *
   * @param callback  Callback function.
   */
  openConnection (callback) {
    let self = this

    // if the connection has already open return and execute the callback
    if (self.status()) {
      return callback(new Error('Connection is already open'))
    }

    // hack: this fix a strange bug on the test environment
    if (self.api.env === 'test' && mongoose.connections[ 0 ]._hasOpened === true) {
      // save the mongoose instance
      self.mongoose = mongoose

      // mark mongoose was connected
      self.connected = true

      // execute the callback function and return
      return callback()
    }

    let connectCallback = () => {
      // save mongoose object
      self.mongoose = mongoose

      // open the new connection
      self.mongoose.connect(self.api.config.models.connectionString, (error) => {
        if (error) { return self.api.log(`MongoDB Error: ${error}`, 'emerg') }

        self.api.log('connected to MongoDB', 'debug')
        self.connected = true
        callback()
      })

      // define handler for disconnected event
      self.mongoose.connection.on('disconnected', () => {
        self.connected = false
        self.api.log('MongoDB Connection Closed', 'debug')
      })
    }

    // check if we are use a mock version of the package
    if (self.api.config.models.pkg === 'mockgoose') {
      // require mockgoose
      let mockgoose = require('mockgoose')

      // wrap mongoose with mockgoose
      mockgoose(mongoose).then(connectCallback)

      // log an warning
      self.api.log('running with mockgoose', 'warning')
    } else {
      connectCallback()
    }
  }

  /**
   * Close connection.
   *
   * @param callback  Callback function.
   */
  closeConnection (callback) {
    let self = this

    // if there is not connection open return now
    if (!self.status()) {
      callback(new Error('There is no connection open'))
      return
    }

    self.mongoose.connection.close(callback)
  }

  /**
   * Return the connection status.
   *
   * @returns {boolean}
   */
  status () { return this.connected }

  /**
   * Add a new model.
   *
   * If the model already exists it will be replaced.
   *
   * @param name    Model name
   * @param schema  Model schema.
   */
  add (name, schema) {
    // if the model already exists that can't be overwrite
    if (this.models.has(name)) { return }

    // the schema definition can be a function, pass the api reference and
    // the mongoose object
    if (typeof schema === 'function') { schema = schema(this.api, mongoose) }

    // save the new model instance
    this.models.set(name, this.mongoose.model(name, schema))
  }

  /**
   * Get a model object from the repository.
   *
   * @param modelName   model name to get.
   * @returns {V}       model object.
   */
  get (modelName) { return this.models.get(modelName) }

  /**
   * Remove a model from the repository.
   *
   * @param modelName   model name to be deleted.
   */
  remove (modelName) { this.models.delete(modelName) }

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
    // cleanup mongoose cache
    mongoose.models = {}
    mongoose.modelSchemas = {}

    // open connection
    api.models.openConnection(() => {
      // read models files from the modules
      api.modules.modulesPaths.forEach(modulePath => {
        Utils.recursiveDirectoryGlob(`${modulePath}/models`).forEach(moduleFile => {
          // get file basename
          let basename = path.basename(moduleFile, '.js')

          // load the model
          api.models.add(basename, require(moduleFile).default)

          // log a message
          api.log(`model loaded: ${basename}`, 'debug')
        })
      })

      // finish the initializer start
      next()
    })
  }

  /**
   * Initializer stop function.
   *
   * @param api   API reference.
   * @param next  Callback function.
   */
  stop (api, next) {
    // close connection
    api.models.closeConnection(next)
  }
}
