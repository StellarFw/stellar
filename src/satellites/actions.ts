import { Satellite } from '../satellite';
import ActionInterface from '../action.interface';
import { LogLevel } from '../log-level.enum';
import MiddlewareInterface from '../middleware.interface';
import Connection from '../connection';

export interface VersionActionMap {
  [key: number]: ActionInterface;
}

/**
 * This contains all the protected keys, that can not be modified by the mod
 * groups.
 *
 * @type {Array}
 */
const PROTECTED_KEYS = ['name', 'run'];

/**
 * System action to show the server status.
 */
class StatusAction implements ActionInterface {
  public name = 'status';
  public description = 'Is a system action to show the server status';

  public async run(api, action) {}
}

export default class ActionsSatellite extends Satellite {
  protected _name: string = 'actions';
  public loadPriority: number = 410;

  /**
   * Dictionary with the registered actions.
   *
   * TODO: fix type on future
   */
  public actions: any = {};

  /**
   * Separate actions by version.
   */
  public versions: Map<string, Array<number>> = new Map();

  /**
   * This Map contains all the metadata changes that be applied to the actions.
   *
   * @type {Map}
   */
  public groups = new Map();

  /**
   * This map stores the actions associated with a group.
   */
  public groupsActions: Map<string, Array<ActionInterface>> = new Map();

  /**
   * Hash map with middleware by actions.
   */
  public middleware: { [key: string]: MiddlewareInterface } = {};

  /**
   * Global middleware.
   */
  public globalMiddleware: Array<string> = [];

  /**
   * Execute an action.
   *
   * This allow developers call actions internally.
   *
   * @param actionName  Name of the action to be called.
   * @param params      Action parameters.
   * @return Promise
   */
  public call(actionName: string, params: any = {}) {
    const connection = new Connection(this.api, {
      type: 'internal',
      remotePort: 0,
      remoteIP: 0,
      rawConnection: {},
    });

    connection.params = params;
    connection.params.action = actionName;

    const ActionProcessor = this.api.ActionProcessor;
    return new Promise((resolve, reject) => {
      const actionProcessor = new ActionProcessor(
        this.api,
        connection,
        data => {
          connection.destroy();
          if (data.response.error !== undefined) {
            return reject(data.response.error);
          }

          resolve(data.response);
        },
      );

      actionProcessor.processAction();
    });
  }

  /**
   * Load some system actions.
   */
  private loadSystemActions() {
    if (this.api.configs.enableSystemActions !== true) {
      return;
    }

    this.versions.set('status', [1]);
    this.actions.status = {
      1: StatusAction,
    };
  }

  /**
   * Load a new action file.
   *
   * @param path Action path
   * @param module Module name
   * @param reload Set to `true` when it's a reload.
   */
  private loadFile(path: string, module: string, reload: boolean = false) {
    const loadMessage = (actionObj: ActionInterface) => {
      const level: LogLevel = reload ? LogLevel.Info : LogLevel.Debug;
      let msg = null;

      if (reload) {
        msg = `action (re)loaded: ${actionObj.name} @ v${
          actionObj.version
        }, ${path}`;
      } else {
        msg = `action loaded: ${actionObj.name} @ v${
          actionObj.version
        }, ${path}`;
      }

      this.api.log(msg, level);
    };

    // watch for changes on the action file
    this.api.config.watchFileAndAct(path, () => {
      // reload file
      this.loadFile(path, module, true);

      // reload post variables
      this.api.params.buildPostVariables();

      // reload routes
      this.api.routes.loadRoutes();
    });

    let action = null;

    try {
      const collection = require(path);

      // iterate all collection definitions
      for (const key in Object.keys(collection)) {
        if (!collection.hasOwnProperty(key)) {
          continue;
        }

        action = collection[key];

        // if there is no version defined set it to 1.0
        if (action.version === null || action.version === undefined) {
          action.version = 1.0;
        }

        // if the action not exists create a new entry on the hash map
        if (
          this.actions[action.name] === null ||
          this.actions[action.name] === undefined
        ) {
          this.actions[action.name] = {};
        }

        // if the action exists and are protected return now
        if (
          this.actions[action.name][action.version] !== undefined &&
          this.actions[action.name][action.version].protected !== undefined &&
          this.actions[action.name][action.version].protected === true
        ) {
          return;
        }

        if (!reload) {
          // associate the action to the module (this must only be made once)
          this.api.modules.regModuleAction(module, action.name);
        } else {
          // Groups: apply the necessary actions modifications (this is only
          // made on the reload because on the loading we don't have the
          // necessary information for this)
          this.applyModificationsToAction(action);
        }

        // put the action on correct version slot
        this.actions[action.name][action.version] = action;
        if (
          this.versions[action.name] === null ||
          this.versions[action.name] === undefined
        ) {
          this.versions[action.name] = [];
        }
        this.versions[action.name].push(action.version);
        this.versions[action.name].sort();

        // validate the action data
        this.validateAction(this.actions[action.name][action.version]);

        // send a log message
        loadMessage(action);
      }
    } catch (err) {
      try {
        this.api.exceptionHandlers.loader(path, err);
        if (action) {
          delete this.actions[action.name][action.version];
        }
      } catch (err2) {
        throw err;
      }
    }
  }

  public loadMiddlewareFromFile(path, reload = false) {
    /**
     * Function to log the load ou reload message
     *
     * @param middleware  Middleware object
     */
    const loadMessage = (middleware: MiddlewareInterface) => {
      const level = reload ? 'info' : 'debug';
      let msg = null;

      if (reload) {
        msg = `middleware (re)loaded: ${middleware.name}, ${path}`;
      } else {
        msg = `middleware loaded: ${middleware.name}, ${path}`;
      }

      this.api.log(msg, level);
    };

    // watch for changes on the middleware file
    this.api.configs.watchFileAndAct(path, () =>
      this.loadMiddlewareFromFile(path, true),
    );

    try {
      const collection = require(path);

      // iterate all collection definitions
      for (const key in Object.keys(collection)) {
        if (!collection.hasOwnProperty(key)) {
          continue;
        }

        const middleware = collection[key];
        this.addMiddleware(middleware);
        loadMessage(middleware);
      }
    } catch (error) {
      this.api.exceptionHandlers.loader(path, error);
    }
  }

  /**
   * Load the modifier and apply it to all already loaded actions.
   *
   * @param {object} modifier
   */
  public loadModifier(modifier) {
    // the modifier is a hash that the keys correspond to group names
    const groups = Object.keys(modifier);

    groups.forEach(groupName => {
      const group = modifier[groupName];

      // array to store the group's actions
      let actions = [];

      // process the `actions` property. This is simpler as concat the two arrays
      if (Array.isArray(group.actions)) {
        actions = actions.concat(group.actions);
      }

      // process the `modules` property
      if (Array.isArray(group.modules)) {
        group.modules.forEach(modulesName => {
          actions = actions.concat(
            this.api.modules.moduleActions.get(modulesName) || [],
          );
        });
      }

      // save the actions that compose this group
      this.groupsActions.set(groupName, actions);

      // save the group metadata modifications to apply to the actions, later
      this.groups.set(groupName, group.metadata);
    });
  }

  /**
   * Applies the modifications to an action from each group that them makes part
   * of.
   *
   * @param {object} action Action object.
   */
  private applyModificationsToAction(action) {
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
    const groupNames = this.checkWhatGroupsArePresent(action.name);

    // apply the changes of all founded groups
    groupNames.forEach(groupName =>
      this.applyGroupModToAction(groupName, action),
    );
  }

  /**
   * Apply the group modification to the action.
   *
   * @param {string} groupName Group name
   * @param {object} action Action object where the modifications must be
   *                        applied.
   */
  private applyGroupModToAction(groupName, action) {
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
   * Gets all the groups thats the given action is part of.
   *
   * @param {string} actionName
   */
  private checkWhatGroupsArePresent(actionName) {
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
   * Iterate all the actions and apply the respective group modifications.
   */
  private applyGroupModifications() {
    // iterate all actions
    Object.keys(this.actions).forEach(actionName => {
      // get all action versions
      const actionVersion = this.actions[actionName];

      // iterate all action versions
      Object.keys(actionVersion).forEach(versionNumber => {
        // apply the group modifications
        this.applyModificationsToAction(actionVersion[versionNumber]);
      });
    });
  }

  /**
   * Iterate all modules and load all actions.
   */
  private loadModuleActions() {
    this.api.modules.modulesPaths.forEach((modulePath, moduleName) => {
      // load modules middleware
      this.api.utils
        .recursiveDirSearch(`${modulePath}/middleware`)
        .forEach(path => this.api.actions.loadMiddlewareFromFile(path));

      // get all files from the module "actions" folder
      this.api.utils
        .recursiveDirSearch(`${modulePath}/actions`)
        .forEach(actionFile =>
          this.api.actions.loadFile(actionFile, moduleName),
        );
    });
  }

  /**
   * Validate some action requirements.
   *
   * @param action  Action object to be validated.
   */
  private validateAction(action: ActionInterface) {
    const fail = msg => this.api.log(msg, LogLevel.Error);

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
    } else if (
      typeof action.description !== 'string' ||
      action.description.length < 1
    ) {
      fail(`Action ${action.name} is missing 'action.description'`);
      return false;
    } else if (typeof action.run !== 'function') {
      fail(`Action ${action.run} has no run method`);
      return false;
    } else if (
      this.api.connections !== null &&
      this.api.connections.allowedVerbs.indexOf(action.name) >= 0
    ) {
      fail(
        `${action.run} is a reserved verb for connections. Choose a new name`,
      );
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
  public addMiddleware(data: MiddlewareInterface) {
    // middleware require a name
    if (!data.name) {
      throw new Error('middleware.name is required');
    }

    // if there is no defined priority use the default
    if (!data.priority) {
      data.priority = this.api.configs.general.defaultMiddlewarePriority;
    }

    // ensure the priority is a number
    data.priority = Number(data.priority);

    // save the new middleware
    this.middleware[data.name] = data;

    // if this is a local middleware return now
    if (data.global !== true) {
      return;
    }

    // push the new middleware to the global list
    this.globalMiddleware.push(data.name);

    // sort the global middleware array
    this.globalMiddleware.sort((a, b) => {
      if (this.middleware[a].priority > this.middleware[b].priority) {
        return 1;
      }

      return -1;
    });
  }

  private loadModuleModifier() {
    this.api.modules.modulesPaths.forEach(modulePath => {
      const modPath = `${modulePath}/mod.js`;

      if (this.api.utils.fileExists(modPath)) {
        this.api.actions.loadModifier(require(modPath)(this.api).actions);

        // when the modifier file changes we must reload the entire server
        this.api.config.watchFileAndAct(modPath, () =>
          this.api.commands.restart(),
        );
      }
    });
  }

  public async load(): Promise<void> {
    this.api.actions = this;

    this.loadSystemActions();
    this.loadModuleActions();

    // Load the modules after the action in order to reduce the number of
    // operations to apply the group modifications
    this.loadModuleModifier();

    this.applyGroupModifications();
  }
}
