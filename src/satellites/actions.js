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
  constructor (api) { this.api = api }

  /**
   * Execute an action.
   *
   * This allow developers call actions internally.
   *
   * @param actionName  Name of the action to be called.
   * @param params      Action parameters.
   * @param callback    Callback function.
   */
  call (actionName, params = {}, callback = () => {}) {
    let self = this

    // make the action call more sweet 🍭
    if (typeof params === 'function') {
      callback = params
      params = {}
    }

    // get connection class
    let ConnectionClass = self.api.connection

    // create a new connection object
    let connection = new ConnectionClass(self.api, {
      type: 'internal',
      remotePort: 0,
      remoteIP: 0,
      rawConnection: {}
    })

    // set connection params
    connection.params = params

    // set action who must be called
    connection.params.action = actionName

    // get action processor class
    let ActionProcessor = self.api.actionProcessor

    // create a new ActionProcessor instance
    let actionProcessor = new ActionProcessor(self.api, connection, data => {
      // execute the callback on the connection destroy event
      connection.destroy(() => callback(data.response.error, data.response))
    })

    // process the action
    actionProcessor.processAction()
  }

  /**
   * This loads some system action.
   *
   * Available action:
   *  - status: give information about the name and the server status.
   */
  loadSystemActions () {
    let self = this

    // only load this if the system actions are enabled
    //
    // @see api.configs.enableSystemActions
    if (self.api.config.enableSystemActions !== true) { return }

    // add an action to give some information about the server status
    self.versions.status = [ 1 ]
    self.actions.status = {
      '1': {
        name: 'status',
        description: 'Is a system action to show the server status',
        run: (api, action, next) => {

          // finish the action execution
          next()
        }
      }
    }
  }

  /**
   * Load a new action file.
   *
   * @param fullFilePath
   * @param reload
   */
  loadFile (fullFilePath, reload = false) {
    let self = this

    let loadMessage = action => {
      let level = reload ? 'info' : 'debug'
      let msg = null

      if (reload) {
        msg = `action (re)loaded: ${action.name} @ v${action.version}, ${fullFilePath}`
      } else {
        msg = `action loaded: ${action.name} @ v${action.version}, ${fullFilePath}`
      }

      self.api.log(msg, level)
    }

    // watch for changes on the action file
    self.api.configs.watchFileAndAct(fullFilePath, () => {
      self.loadFile(fullFilePath, true)
      self.api.params.buildPostVariables()
      self.api.routes.loadRoutes()
    })

    let action = null

    // try load the action
    try {
      // load action file
      let collection = require(fullFilePath)

      // iterate all collection definitions
      for (let i in collection) {
        // get action object
        action = collection[ i ]

        // if there is no version defined set it to 1.0
        if (action.version === null || action.version === undefined) { action.version = 1.0 }

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
        self.actions[ action.name ][ action.version ] = action
        if (self.versions[ action.name ] === null || self.versions[ action.name ] === undefined) {
          self.versions[ action.name ] = []
        }
        self.versions[ action.name ].push(action.version)
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
   * @param action  Action object to be validated.
   */
  validateAction (action) {
    let self = this

    // fail function
    let fail = msg => self.api.log(msg, 'error')

    // initialize inputs property
    if (action.inputs === undefined) { action.inputs = {} }

    // initialize private property
    if (action.private === undefined) { action.private = false }

    // initialize protected property
    if (action.protected === undefined) { action.protected = false }

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

  /**
   * Add a new middleware.
   *
   * @param data  Middleware to be added.
   */
  addMiddleware (data) {
    let self = this

    // middleware require a name
    if (!data.name) { throw new Error('middleware.name is required')}

    // if there is no defined priority use the default
    if (!data.priority) { data.priority = self.api.config.general.defaultMiddlewarePriority }

    // ensure the priority is a number
    data.priority = Number(data.priority)

    // save the new middleware
    self.middleware[ data.name ] = data

    // if this is a local middleware return now
    if (data.global !== true) { return }

    // push the new middleware to the global list
    self.globalMiddleware.push(data.name)

    // sort the global middleware array
    self.globalMiddleware.sort((a, b) => {
      if (self.middleware[ a ].priority > self.middleware[ b ].priority) { return 1 }

      return -1
    })
  }

  loadMiddlewareFromFile (path, reload = false) {
    let self = this

    /**
     * Function to log the load ou reload message
     *
     * @param middleware  Middleware object
     */
    let loadMessage = middleware => {
      let level = reload ? 'info' : 'debug'
      let msg = null

      if (reload) {
        msg = `middleware (re)loaded: ${middleware.name}, ${path}`
      } else {
        msg = `middleware loaded: ${middleware.name}, ${path}`
      }

      self.api.log(msg, level)
    }

    // watch for changes on the middleware file
    self.api.configs.watchFileAndAct(path, () => self.loadMiddlewareFromFile(path, true))

    // try load the middleware
    try {
      // load middleware file
      let collection = require(path)

      // iterate all collection definitions
      for (let index in collection) {
        // get middleware object
        let middleware = collection[ index ]

        // try load middleware object
        self.addMiddleware(middleware)

        // send a log message
        loadMessage(middleware)
      }
    } catch (error) {
      self.api.exceptionHandlers.loader(path, error)
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
  loadPriority = 410

  /**
   * Initializer load function.
   *
   * @param api   API reference
   * @param next  Callback function
   */
  load (api, next) {
    // add the actions class to the api
    api.actions = new Actions(api)

    // load system actions
    api.actions.loadSystemActions()

    // iterate all modules and load all actions
    api.modules.modulesPaths.forEach(modulePath => {
      // load modules middleware
      api.utils.recursiveDirectoryGlob(`${modulePath}/middleware`).forEach(path => api.actions.loadMiddlewareFromFile(path))

      // get all files from the module "actions" folder
      api.utils.recursiveDirectoryGlob(`${modulePath}/actions`).forEach(actionFile => api.actions.loadFile(actionFile))
    })

    // finish initializer loading
    next()
  }

}
