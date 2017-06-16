'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

/**
 * This contains all the protected keys, that can not be modified by the mod
 * groups.
 *
 * @type {Array}
 */
const PROTECTED_KEYS = ['name', 'run'];

/**
 * This class manage all actions.
 */
class Actions {

  /**
   * Create a new actions manager instance.
   *
   * @param api
   */


  /**
   * This Map contains all the metadata changes that be applied to the actions.
   *
   * @type {Map}
   */


  /**
   * Hash map with the middleware by actions.
   *
   * @type {{}}
   */


  /**
   * Hash map with the registered actions.
   *
   * @type {{}}
   */
  constructor(api) {
    this.api = null;
    this.actions = {};
    this.versions = {};
    this.middleware = {};
    this.globalMiddleware = [];
    this.groups = new Map();
    this.groupsActions = new Map();
    this.api = api;
  }

  /**
   * Execute an action.
   *
   * This allow developers call actions internally.
   *
   * @param actionName  Name of the action to be called.
   * @param params      Action parameters.
   * @return Promise
   */


  /**
   * This Map stores the actions associated with a group.
   *
   * @type {Map}
   */


  /**
   * Global middleware.
   *
   * @type {Array}
   */


  /**
   * Separate actions by version.
   *
   * @type {{}}
   */


  /**
   * API reference.
   *
   * @type {null}
   */
  call(actionName, params = {}) {
    // get connection class
    const ConnectionClass = this.api.connection;

    // create a new connection object
    const connection = new ConnectionClass(this.api, {
      type: 'internal',
      remotePort: 0,
      remoteIP: 0,
      rawConnection: {}
    });

    // set connection params
    connection.params = params;

    // set action who must be called
    connection.params.action = actionName;

    // get action processor class
    const ActionProcessor = this.api.actionProcessor;

    // return a promise
    return new Promise((resolve, reject) => {
      // create a new ActionProcessor instance
      const actionProcessor = new ActionProcessor(this.api, connection, data => {
        // destroy the connection and resolve of reject the promise
        connection.destroy(() => {
          if (data.response.error !== undefined) {
            return reject(data.response.error);
          }

          resolve(data.response);
        });
      });

      // process the action
      actionProcessor.processAction();
    });
  }

  /**
   * This loads some system action.
   *
   * Available action:
   *  - status: give information about the name and the server status.
   */
  loadSystemActions() {
    let self = this;

    // only load this if the system actions are enabled
    //
    // @see api.configs.enableSystemActions
    if (self.api.config.enableSystemActions !== true) {
      return;
    }

    // add an action to give some information about the server status
    self.versions.status = [1];
    self.actions.status = {
      '1': {
        name: 'status',
        description: 'Is a system action to show the server status',
        run: (api, action, next) => {

          // finish the action execution
          next();
        }
      }
    };
  }

  /**
   * Load a new action file.
   *
   * @param fullFilePath
   * @param reload
   */
  loadFile(fullFilePath, moduleName, reload = false) {
    let self = this;

    let loadMessage = action => {
      let level = reload ? 'info' : 'debug';
      let msg = null;

      if (reload) {
        msg = `action (re)loaded: ${action.name} @ v${action.version}, ${fullFilePath}`;
      } else {
        msg = `action loaded: ${action.name} @ v${action.version}, ${fullFilePath}`;
      }

      self.api.log(msg, level);
    };

    // watch for changes on the action file
    self.api.configs.watchFileAndAct(fullFilePath, () => {
      // reload file
      self.loadFile(fullFilePath, moduleName, true);

      // reload post variables
      self.api.params.buildPostVariables();

      // reload routes
      self.api.routes.loadRoutes();
    });

    let action = null;

    // try load the action
    try {
      // load action file
      let collection = require(fullFilePath);

      // iterate all collection definitions
      for (let i in collection) {
        // get action object
        action = collection[i];

        // if there is no version defined set it to 1.0
        if (action.version === null || action.version === undefined) {
          action.version = 1.0;
        }

        // if the action not exists create a new entry on the hash map
        if (self.actions[action.name] === null || self.actions[action.name] === undefined) {
          self.actions[action.name] = {};
        }

        // if the action exists and are protected return now
        if (self.actions[action.name][action.version] !== undefined && self.actions[action.name][action.version].protected !== undefined && self.actions[action.name][action.version].protected === true) {
          return;
        }

        if (!reload) {
          // associate the action to the module (this must only be made once)
          this.api.modules.regModuleAction(moduleName, action.name);
        } else {
          // Groups: apply the necessary actions modifications (this is only
          // made on the reload because on the loading we don't have the
          // necessary information for this)
          this._applyModificationsToAction(action);
        }

        // put the action on correct version slot
        self.actions[action.name][action.version] = action;
        if (self.versions[action.name] === null || self.versions[action.name] === undefined) {
          self.versions[action.name] = [];
        }
        self.versions[action.name].push(action.version);
        self.versions[action.name].sort();

        // validate the action data
        self.validateAction(self.actions[action.name][action.version]);

        // send a log message
        loadMessage(action);
      }
    } catch (err) {
      try {
        self.api.exceptionHandlers.loader(fullFilePath, err);
        if (action) {
          delete self.actions[action.name][action.version];
        }
      } catch (err2) {
        throw err;
      }
    }
  }

  /**
   * Validate some action requirements.
   *
   * @param action  Action object to be validated.
   */
  validateAction(action) {
    let self = this;

    // fail function
    let fail = msg => self.api.log(msg, 'error');

    // initialize inputs property
    if (action.inputs === undefined) {
      action.inputs = {};
    }

    // initialize private property
    if (action.private === undefined) {
      action.private = false;
    }

    // initialize protected property
    if (action.protected === undefined) {
      action.protected = false;
    }

    // the name, description, run properties are required
    if (typeof action.name !== 'string' || action.name.length < 1) {
      fail(`an action is missing 'action.name'`);
      return false;
    } else if (typeof action.description !== 'string' || action.description.length < 1) {
      fail(`Action ${action.name} is missing 'action.description'`);
      return false;
    } else if (typeof action.run !== 'function') {
      fail(`Action ${action.run} has no run method`);
      return false;
    } else if (self.api.connections !== null && self.api.connections.allowedVerbs.indexOf(action.name) >= 0) {
      fail(`${action.run} is a reserved verb for connections. Choose a new name`);
      return false;
    } else {
      return true;
    }
  }

  /**
   * Add a new middleware.
   *
   * @param data  Middleware to be added.
   */
  addMiddleware(data) {
    let self = this;

    // middleware require a name
    if (!data.name) {
      throw new Error('middleware.name is required');
    }

    // if there is no defined priority use the default
    if (!data.priority) {
      data.priority = self.api.config.general.defaultMiddlewarePriority;
    }

    // ensure the priority is a number
    data.priority = Number(data.priority);

    // save the new middleware
    self.middleware[data.name] = data;

    // if this is a local middleware return now
    if (data.global !== true) {
      return;
    }

    // push the new middleware to the global list
    self.globalMiddleware.push(data.name);

    // sort the global middleware array
    self.globalMiddleware.sort((a, b) => {
      if (self.middleware[a].priority > self.middleware[b].priority) {
        return 1;
      }

      return -1;
    });
  }

  loadMiddlewareFromFile(path, reload = false) {
    let self = this;

    /**
     * Function to log the load ou reload message
     *
     * @param middleware  Middleware object
     */
    let loadMessage = middleware => {
      let level = reload ? 'info' : 'debug';
      let msg = null;

      if (reload) {
        msg = `middleware (re)loaded: ${middleware.name}, ${path}`;
      } else {
        msg = `middleware loaded: ${middleware.name}, ${path}`;
      }

      self.api.log(msg, level);
    };

    // watch for changes on the middleware file
    self.api.configs.watchFileAndAct(path, () => self.loadMiddlewareFromFile(path, true));

    // try load the middleware
    try {
      // load middleware file
      let collection = require(path);

      // iterate all collection definitions
      for (let index in collection) {
        // get middleware object
        let middleware = collection[index];

        // try load middleware object
        self.addMiddleware(middleware);

        // send a log message
        loadMessage(middleware);
      }
    } catch (error) {
      self.api.exceptionHandlers.loader(path, error);
    }
  }

  // ----------------------------------------------------- [Modification System]

  /**
   * Load the modifier and apply it to all already loaded actions.
   *
   * @param {object} modifier
   */
  loadModifier(modifier) {
    // the modifier is a hash that the keys correspond to group names
    const groups = Object.keys(modifier);

    // iterate all groups
    groups.forEach(groupName => {
      // get the group content
      const group = modifier[groupName];

      // array to store the group's actions
      let actions = [];

      // process the `actions` property. This is simpler as concat the two arrays
      if (Array.isArray(group.actions)) {
        actions = actions.concat(group.actions);
      }

      // process the `modules` property
      if (Array.isArray(group.modules)) {
        // iterate all groups and for each one load the actions
        group.modules.forEach(groupName => {
          actions = actions.concat(this.api.modules.moduleActions.get(groupName) || []);
        });
      }

      // save the actions that compose this group
      this.groupsActions.set(groupName, actions);

      // save the group metadata modifications to apply to the actions, later
      this.groups.set(groupName, group.metadata);
    });
  }

  /**
   * Gets all the groups thats the given action is part of.
   *
   * @param {string} actionName
   */
  _checkWhatGroupsArePresent(actionName) {
    // this array will store the groups of which the action is part
    const result = [];

    // iterate all groups
    this.groupsActions.forEach((actions, groupName) => {
      if (actions.includes(actionName)) {
        result.push(groupName);
      }
    });

    return result;
  }

  /**
   * Apply the group modification to the action.
   *
   * @param {string} groupName Group name
   * @param {object} action Action object where the modifications must be
   *                        applied.
   */
  _applyGroupModToAction(groupName, action) {
    // get group metadata modifications
    const metadata = this.groups.get(groupName);

    // iterate all modification keys
    for (let key of Object.keys(metadata)) {
      let value = metadata[key];

      // if there is a protected key, ignore it
      if (PROTECTED_KEYS.includes(key)) {
        continue;
      }

      // check if the key start with a '+'. If yes, that means that is to
      // append an item to an array, or create it if not exists
      if (key.charAt(0) === '+') {
        // create a sub-string without the plus sign
        key = key.substring(1, key.length);

        // set the new value
        action[key] = (action[key] || []).concat(value);

        continue;
      } else if (key.charAt(0) === '-') {
        // create a sub-string without the plus sign
        key = key.substring(1, key.length);

        // this needs to be an Array
        if (Array.isArray(action[key])) {
          action[key] = action[key].filter(item => !value.includes(item));
        }

        continue;
      }

      // if the value is a function we need process it
      if (typeof value === 'function') {
        value = value(action, action[key]);
      }

      // replace the value
      action[key] = value;
    }
  }

  /**
   * Applies the modifications to an action from each group that them makes part
   * of.
   *
   * @param {object} action Action object.
   */
  _applyModificationsToAction(action) {
    // when the action has a group defined, the action name must be pushed
    // to the `groupsActions`
    if (this.api.utils.isNonEmptyString(action.group)) {
      // if the key doesn't exists we must create one with an empty array
      if (!this.groupsActions.has(action.group)) {
        this.groupsActions.set(action.group, []);
      }

      // get the array of actions
      const arrayOfActions = this.groupsActions.get(action.group);

      // to prevent duplicated entries, it's necessary check if the array
      // already exists on the array
      if (!arrayOfActions.includes(action.name)) {
        arrayOfActions.push(action.name);
      }
    }

    // check the groups here the action is present and apply the modifications
    const groupNames = this._checkWhatGroupsArePresent(action.name);

    // apply the changes of all founded groups
    groupNames.forEach(groupName => this._applyGroupModToAction(groupName, action));
  }

  /**
   * Iterate all the actions and apply the respective group modifications.
   */
  _applyGroupModifications() {
    // iterate all actions
    Object.keys(this.actions).forEach(actionName => {
      // get all action versions
      const actionVersion = this.actions[actionName];

      // iterate all action versions
      Object.keys(actionVersion).forEach(versionNumber => {
        // apply the group modifications
        this._applyModificationsToAction(actionVersion[versionNumber]);
      });
    });
  }
}

/**
 * Initializer to load the actions features into the Engine.
 */
exports.default = class {
  constructor() {
    this.loadPriority = 410;
  }

  /**
   * Initializer load priority.
   *
   * @type {number}
   */


  /**
   * Initializer load function.
   *
   * @param api   API reference
   * @param next  Callback function
   */
  load(api, next) {
    // add the actions class to the api
    api.actions = new Actions(api);

    // load system actions
    api.actions.loadSystemActions();

    // iterate all modules and load all actions
    api.modules.modulesPaths.forEach((modulePath, moduleName) => {
      // load modules middleware
      api.utils.recursiveDirectoryGlob(`${modulePath}/middleware`).forEach(path => api.actions.loadMiddlewareFromFile(path));

      // get all files from the module "actions" folder
      api.utils.recursiveDirectoryGlob(`${modulePath}/actions`).forEach(actionFile => api.actions.loadFile(actionFile, moduleName));
    });

    // load the modules after the action in order to reduce the number of
    // operations to apply the group modifications
    api.modules.modulesPaths.forEach(modulePath => {
      // build the mod path
      const modPath = `${modulePath}/mod.js`;

      // if the module `mod.js` file exists, load it
      if (api.utils.fileExists(modPath)) {
        api.actions.loadModifier(require(modPath)(api).actions);
      }
    });

    // apply the group modifications
    api.actions._applyGroupModifications();

    // finish initializer loading
    next();
  }

};