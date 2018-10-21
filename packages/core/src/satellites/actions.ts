import {
  Satellite,
  IActionMetadata,
  Action,
  LogLevel,
  Connection,
  MiddlewareInterface,
  ActionMetadata,
} from "@stellarfw/common";
import { ACTION_METADATA } from "@stellarfw/common/constants";

export interface VersionActionMap {
  [key: number]: Action;
}

/**
 * This contains all the protected keys, that can not be modified by the mod
 * groups.
 *
 * @type {Array}
 */
const PROTECTED_KEYS = ["name", "run"];

/**
 * System action to show the server status.
 */
@ActionMetadata({
  name: "status",
  description: "Is a system action to show the server status",
})
class StatusAction extends Action {
  public async run() {}
}

export default class ActionsSatellite extends Satellite {
  protected _name: string = "actions";
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
  public groupsActions: Map<string, Array<Action>> = new Map();

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
      type: "internal",
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

    this.versions.set("status", [1]);
    this.actions.status = {
      1: StatusAction,
    };
  }

  /**
   * Print out a message that informs the action (re)load.
   *
   * @param actionMetadata Metadata of the action that is being loaded.
   * @param path Path to the action file.
   * @param reload Informs if this is a reload.
   */
  private actionLoadMessage(
    actionMetadata: IActionMetadata,
    path: string,
    reload: boolean = false,
  ) {
    const level: LogLevel = reload ? LogLevel.Info : LogLevel.Debug;
    let msg = null;

    if (reload) {
      msg = `action (re)loaded: ${actionMetadata.name} @ v${
        actionMetadata.version
      }, ${path}`;
    } else {
      msg = `action loaded: ${actionMetadata.name} @ v${
        actionMetadata.version
      }, ${path}`;
    }

    this.api.log(msg, level);
  }

  /**
   * Loads an action into memory.
   *
   * @param action Action to be loaded.
   */
  private loadAction(
    action: Action,
    path: string,
    module: string,
    reload: boolean = false,
  ): void {
    // Ignore when the given "action" isn't an function. That
    // means the user isn't use an Class.
    if (typeof action !== "function") {
      return;
    }

    // To be a valid action must contain the Action metadata. In
    // case of error we must print an error instead of an action
    // we want continue loading the file to search for more
    // actions.
    if (!Reflect.hasMetadata(ACTION_METADATA, action)) {
      this.api.log(`Invalid action on @ ${path}`, LogLevel.Error);
      return;
    }

    const metadata: IActionMetadata = Reflect.getMetadata(
      ACTION_METADATA,
      action,
    );

    // If the action not exists create a new entry on the hash map
    if (
      this.actions[metadata.name] === null ||
      this.actions[metadata.name] === undefined
    ) {
      this.actions[metadata.name] = {};
    }

    // Protected actions can't be override by other modules.
    if (
      !reload &&
      this.actions[metadata.name][metadata.version] &&
      this.actions[metadata.name][metadata.version].protected
    ) {
      return;
    }

    if (!reload) {
      // associate the action to the module (this must only be made once)
      this.api.modules.regModuleAction(module, metadata.name);
    } else {
      // Groups: apply the necessary actions modifications (this is only
      // made on the reload because on the loading we don't have the
      // necessary information for this)
      this.applyModificationsToAction(action);
    }

    // Put the action on the correct version slot
    this.actions[metadata.name][metadata.version] = action;
    if (
      this.versions[metadata.name] === null ||
      this.versions[metadata.name] === undefined
    ) {
      this.versions[metadata.name] = [];
    }
    this.versions[metadata.name].push(metadata.version);
    this.versions[metadata.name].sort();

    this.validateAction(this.actions[metadata.name][metadata.version]);
    this.actionLoadMessage(metadata, path);
  }

  /**
   * Load a new action file.
   *
   * @param path Action path
   * @param module Module name
   * @param reload Set to `true` when it's a reload.
   */
  private loadFile(path: string, module: string, reload: boolean = false) {
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

      for (const key in collection) {
        if (!collection.hasOwnProperty(key)) {
          continue;
        }

        action = collection[key] as typeof Action;
        this.loadAction(action, path, module);
      }
    } catch (err) {
      try {
        this.api.exceptionHandlers.loader(path, err);
        if (action) {
          delete this.actions[action.id][action.version];
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
      const level = reload ? "info" : "debug";
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
      if (!arrayOfActions.includes(action.id)) {
        arrayOfActions.push(action.id);
      }
    }

    // check the groups here the action is present and apply the modifications
    const groupNames = this.checkWhatGroupsArePresent(action.id);

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
      if (key.charAt(0) === "+") {
        // create a sub-string without the plus sign
        key = key.substring(1, key.length);

        // set the new value
        action[key] = (action[key] || []).concat(value);

        continue;
      } else if (key.charAt(0) === "-") {
        // create a sub-string without the plus sign
        key = key.substring(1, key.length);

        // this needs to be an Array
        if (Array.isArray(action[key])) {
          action[key] = action[key].filter(item => !value.includes(item));
        }

        continue;
      }

      // if the value is a function we need process it
      if (typeof value === "function") {
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
  private validateAction(action: Action) {
    const actionMetadata: IActionMetadata = Reflect.getMetadata(
      ACTION_METADATA,
      action,
    );
    const fail = msg => this.api.log(msg, LogLevel.Error);

    // initialize inputs property
    if (actionMetadata.inputs === undefined) {
      actionMetadata.inputs = {};
    }

    // initialize private property
    if (actionMetadata.private === undefined) {
      actionMetadata.private = false;
    }

    // initialize protected property
    if (actionMetadata.protected === undefined) {
      actionMetadata.protected = false;
    }

    // the name, description, run properties are required
    if (
      typeof actionMetadata.name !== "string" ||
      actionMetadata.name.length < 1
    ) {
      fail(`an action is missing 'action.id'`);
      return false;
    } else if (
      typeof actionMetadata.description !== "string" ||
      actionMetadata.description.length < 1
    ) {
      fail(`Action ${actionMetadata.name} is missing 'action.description'`);
      return false;
    } else if (
      this.api.connections !== null &&
      this.api.connections.allowedVerbs.indexOf(actionMetadata.name) >= 0
    ) {
      fail(
        `${action.run} is a reserved verb for connections. Choose a new name`,
      );
      return false;
    }

    return true;
  }

  /**
   * Add a new middleware.
   *
   * @param data  Middleware to be added.
   */
  public addMiddleware(data: MiddlewareInterface) {
    // middleware require a name
    if (!data.name) {
      throw new Error("middleware.name is required");
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
