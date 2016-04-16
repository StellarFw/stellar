// initializer modules
import Utils from '../utils'

/**
 * This class manage all actions.
 */
class Actions {

  /**
   * API reference.
   *
   * @type {null}
   */
  api = null

  /**
   * Hash map with the registered actions.
   *
   * @type {{}}
   */
  actions = {}

  /**
   * Separate actions by version.
   *
   * @type {{}}
   */
  versions = {}

  /**
   * Hash map with the middleware by actions.
   *
   * @type {{}}
   */
  middleware = {}

  /**
   * Global middleware.
   *
   * @type {Array}
   */
  globalMiddleware = []

  /**
   * Create a new actions manager instance.
   *
   * @param api
   */
  constructor(api) {
    this.api = api
  }

  /**
   * Load a new action file.
   *
   * @param fullFilePath
   * @param reload
   */
  loadFile(fullFilePath, reload = false) {
    let self = this

    let loadMessage = function (action) {
      if (reload) {
        self.api.log(`action (re)loaded: ${action.name} @ v${action.version}, ${fullFilePath}`, 'debug')
      } else {
        self.api.log(`action loaded: ${action.name} @ v${action.version}, ${fullFilePath}`, 'debug')
      }
    };

    // watch for changes on the action file
    self.api.watchFileAndAct(fullFilePath, function () {
      self.loadFile(fullFilePath, true)
      self.api.params.buildPostVariables()
      self.api.routes.loadRoutes()
    });

    // try load the action
    try {
      // load action file
      let collection = require(fullFilePath)

      // iterate all collection definitions
      for (let i in collection) {
        // get action object
        let action = collection[ i ]

        // if there is no version defined set it to 1.0
        if (action.version === null || action.version === undefined) {
          action.version = 1.0
        }

        // if the action not exists create a new entry on the hash map
        if (self.actions[ action.name ] === null || self.actions[ action.name ] === undefined) {
          self.actions[ action.name ] = {}
        }

        // if the action exists and are protected return now
        if (self.actions[ action.name ][ action.version ] !== undefined &&
          self.actions[ action.name ][ action.version ].protected !== undefined &&
          self.actions[ action.name ][ action.version ].protected === true) {
          return
        }

        // put the action on correct version slot
        self.actions[ action.name ][ action.version ] = action;
        if (self.versions[ action.name ] === null || self.versions[ action.name ] === undefined) {
          self.versions[ action.name ] = []
        }
        self.versions[ action.name ].push(action.version);
        self.versions[ action.name ].sort()

        // validate the action data
        self.validateAction(self.actions[ action.name ][ action.version ])

        // send a log message
        loadMessage(action)
      }
    } catch (err) {
      try {
        self.api.exceptionHandlers.loader(fullFilePath, err)
        delete self.actions[ action.name ][ action.version ]
      } catch (err2) {
        throw err
      }
    }
  }

  /**
   * Validate some action requirements.
   *
   * @param param
   */
  validateAction(action) {
    let self = this

    let fail = function (msg) { self.api.log(msg, 'error') }

    if (action.inputs === undefined) { action.inputs = {} }

    // the name, description, run properties are required
    if (typeof action.name !== 'string' || action.name.length < 1) {
      fail(`an action is missing 'action.name'`)
      return false
    } else if (typeof action.description !== 'string' || action.description.length < 1) {
      fail(`Action ${action.name} is missing 'action.description'`)
      return false
    } else if (typeof action.run !== 'function') {
      fail(`Action ${action.run} has no run method`)
      return false
    } else if (self.api.connections !== null && self.api.connections.allowedVerbs.indexOf(action.name) >= 0) {
      fail(`${action.run} is a reserved verb for connections. Choose a new name`)
      return false
    } else {
      return true
    }
  }
}

/**
 * Initializer to load the actions features into the Engine.
 */
export default class {

  /**
   * Initializer load priority.
   *
   * @type {number}
   */
  static loadPriority = 410;

  /**
   * Initializer load function.
   *
   * @param api   API reference
   * @param next  Callback function
   */
  static load(api, next) {
    // add the actions class to the api
    api.actions = new Actions(api)

    // iterate all modules and load all actions
    api.config.activeModules.forEach((moduleName) => {
      // get all files from the module "actions" folder
      Utils.recursiveDirectoryGlob(`${api.scope.rootPath}/modules/${moduleName}/actions`).forEach((actionFile) => {
        // load action file
        api.actions.loadFile(actionFile)
      })
    })

    // finish initializer loading
    next()
  }

}
