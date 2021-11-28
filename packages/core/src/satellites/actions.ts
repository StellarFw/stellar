import {
  Connection,
  Satellite,
  Action,
  LogLevel,
  IMiddleware,
  IActionSatellite,
  Result,
  ok,
  err,
  some,
  always,
} from "@stellarfw/common/lib";
import { statusAction } from "../base/system-actions";

/**
 * Map with the action by version.
 */
export interface VersionActionMap {
  [key: number]: Action<unknown, unknown>;
}

/**
 * All actions with store organized by version number.
 */
export interface ActionsStore {
  [action: string]: {
    [version: number]: Action<unknown, unknown>;
  };
}

/**
 * This contains all the protected keys, that can not be modified by the mod
 * groups.
 *
 * @type {Array}
 */
const PROTECTED_KEYS = ["name"];

export default class ActionsSatellite extends Satellite implements IActionSatellite {
  protected _name = "actions";
  public loadPriority = 410;

  /**
   * Dictionary with the registered actions.
   */
  public actions: ActionsStore = {};

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
  public groupActions: Map<string, Array<Action<unknown, unknown>>> = new Map();

  /**
   * Hash map with middleware by actions.
   */
  public middleware: { [key: string]: IMiddleware } = {};

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
  public call<T, R, E = string>(actionName: string, rawParams: T): Promise<Result<R, E>> {
    const params = rawParams ?? {};
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
      const actionProcessor = new ActionProcessor(this.api, connection, (data) => {
        connection.destroy();
        if (data.response.error !== undefined) {
          return reject(data.response.error);
        }

        resolve(data.response);
      });

      actionProcessor.processAction();
    });
  }

  /**
   * Load some system actions.
   */
  private loadSystemActions() {
    // when the system actions are disabled via configs we can return here
    if (this.api.configs.enableSystemActions !== true) {
      return;
    }

    this.loadAction(statusAction, "core");
  }

  /**
   * Print out a message that informs the action (re)load.
   *
   * @param action Metadata of the action that is being loaded.
   * @param reload Informs if this is a reload.
   */
  private actionLoadMessage(action: Action<unknown, unknown>, reload = false) {
    const level: LogLevel = reload ? LogLevel.Info : LogLevel.Debug;
    const msg = reload
      ? `action (re)loaded: ${action.name} @ v${action.version}`
      : `action loaded: ${action.name} @ v${action.version}`;

    const msgToPrint =
      action.path?.match({
        none: always(msg),
        some: (path) => `${msg}, ${path}`,
      }) ?? msg;

    this.api.log(msgToPrint, level);
  }

  /**
   * Loads an action into memory.
   *
   * @param action Action to be loaded.
   */
  private loadAction(action: Action<unknown, unknown>, module: string, reload = false): Result<true, string> {
    // when there is no version defined use a default one
    const actionVersion = action.version ?? 1;

    // initialize some fields when not set
    const newAction: Action<unknown, unknown> = {
      ...action,
      inputs: action.inputs ?? {},
      private: action.private ?? false,
      protected: action.protected ?? false,
    };

    const actionValidation = this.validateAction(newAction);
    if (actionValidation.isErr()) {
      this.api.log(actionValidation.unwrapErr(), LogLevel.Error, newAction);
      return actionValidation;
    }

    // If the action not exists create a new entry on the hash map
    if (!this.actions[newAction.name]) {
      this.actions[newAction.name] = {};
    }

    // Protected actions can't be override by other modules.
    if (
      !reload &&
      this.actions[newAction.name][actionVersion] &&
      this.actions[newAction.name][actionVersion].protected
    ) {
      return err("Protected actions can't be replaced");
    }

    if (!reload) {
      // associate the action to the module (this must only be made once)
      const regResult = this.api.modules.regModuleAction(module, newAction.name);
      if (regResult.isErr()) {
        this.api.log(regResult.unwrapErr(), LogLevel.Error, newAction);
        return regResult;
      }
    } else {
      // Groups: apply the necessary actions modifications (this is only made on the reload because on the loading we
      // don't have the necessary information for this)
      this.applyModificationsToAction(action);
    }

    // Put the action on the correct version slot
    this.actions[newAction.name][actionVersion] = newAction;

    // Keep track of the action versions
    const currentActionVersions = this.versions.get(newAction.name) ?? [];
    this.versions.set(action.name, [...currentActionVersions, actionVersion].sort());

    this.actionLoadMessage(action, reload);

    return ok(true);
  }

  /**
   * Load a new action file.
   *
   * @param path Action path
   * @param module Module name
   * @param reload Set to `true` when it's a reload.
   */
  private async loadFile(path: string, module: string, reload = false): Promise<Result<true, string>> {
    // when is the first time loading the file add a new watch for changes on the action file
    !reload &&
      this.api.config.watchFileAndAct(path, () => {
        // we need to reload the file, reload the post variables and finally load the routes
        this.loadFile(path, module, true);
        this.api.params.buildPostVariables();
        this.api.routes.loadRoutes();
      });

    let action: Action<unknown, unknown, unknown>;

    try {
      const collection = await import(path);
      console.log("🚀 ~ file: actions.ts ~ line 228 ~ ActionsSatellite ~ loadFile ~ collection", collection);

      for (const key in collection) {
        if (!collection.hasOwnProperty(key)) {
          continue;
        }

        // TODO: check if the object is a valid Action
        action = collection[key] as Action<unknown, unknown>;
        const actionToAdd = { ...action, path: some(path) } as Action<unknown, unknown>;
        this.loadAction(actionToAdd, module);
      }
    } catch (err) {
      try {
        this.api.exceptionHandlers.loader(path, err);
        if (action!) {
          delete this.actions[action.name][action.version!];
        }
      } catch (err2) {
        return err(err2);
      }
    }

    return ok(true);
  }

  public loadMiddlewareFromFile(path, reload = false) {
    /**
     * Function to log the load ou reload message
     *
     * @param middleware  Middleware object
     */
    const loadMessage = (middleware: IMiddleware) => {
      const level = reload ? "info" : "debug";
      let msg: string;

      if (reload) {
        msg = `middleware (re)loaded: ${middleware.name}, ${path}`;
      } else {
        msg = `middleware loaded: ${middleware.name}, ${path}`;
      }

      this.api.log(msg, level);
    };

    // watch for changes on the middleware file
    this.api.configs.watchFileAndAct(path, () => this.loadMiddlewareFromFile(path, true));

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
  public applyModifier(modifier) {
    // the modifier is a hash that the keys correspond to group names
    const groups = Object.keys(modifier);

    groups.forEach((groupName) => {
      const group = modifier[groupName];

      // array to store the group's actions
      let actions = [];

      // process the `actions` property. This is simpler as concat the two arrays
      if (Array.isArray(group.actions)) {
        actions = actions.concat(group.actions);
      }

      // process the `modules` property
      if (Array.isArray(group.modules)) {
        group.modules.forEach((modulesName) => {
          actions = actions.concat(this.api.modules.moduleActions.get(modulesName) || []);
        });
      }

      // save the actions that compose this group
      this.groupActions.set(groupName, actions);

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
      if (!this.groupActions.has(action.group)) {
        this.groupActions.set(action.group, []);
      }

      // get the array of actions
      const arrayOfActions = this.groupActions.get(action.group)!;

      // to prevent duplicated entries, it's necessary check if the array
      // already exists on the array
      if (!arrayOfActions.includes(action.id)) {
        arrayOfActions.push(action.id);
      }
    }

    // check the groups here the action is present and apply the modifications
    const groupNames = this.checkWhatGroupsArePresent(action.id);

    // apply the changes of all founded groups
    groupNames.forEach((groupName) => this.applyGroupModToAction(groupName, action));
  }

  /**
   * Apply the group modification to the action.
   *
   * @param {string} groupName Group name
   * @param {object} action Action object where the modifications must be
   *                        applied.
   */
  private applyGroupModToAction(groupName, action) {
    console.log(">", action);
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
          action[key] = action[key].filter((item) => !value.includes(item));
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
    const result: Array<string> = [];

    // iterate all groups
    this.groupActions.forEach((actions, groupName) => {
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
    Object.keys(this.actions).forEach((actionName) => {
      // get all action versions
      const actionVersion = this.actions[actionName];

      // iterate all action versions
      Object.keys(actionVersion).forEach((versionNumber) => {
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
        .forEach((path) => this.loadMiddlewareFromFile(path));

      // get all files from the module "actions" folder
      this.api.utils
        .recursiveDirSearch(`${modulePath}/actions`)
        .forEach((actionFile) => this.loadFile(actionFile, moduleName));
    });
  }

  /**
   * Validate some action requirements.
   *
   * @param action  Action object to be validated.
   */
  private validateAction(action: Action<unknown, unknown>): Result<true, string> {
    // the name, description, run properties are required
    if (typeof action.name !== "string" || action.name.length < 1) {
      return err("an action is missing the 'name' property");
    } else if (typeof action.description !== "string" || action.description.length < 1) {
      return err(`Action ${action.name} is missing the 'description' property`);
    } else if (this.api.connections !== null && this.api.connections.allowedVerbs.indexOf(action.name) >= 0) {
      return err(`${action.run} is a reserved verb for connections. Choose a new name`);
    }

    return ok(true);
  }

  /**
   * Add a new middleware.
   *
   * @param data  Middleware to be added.
   */
  public addMiddleware(data: IMiddleware) {
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
      if (this.middleware[a].priority! > this.middleware[b].priority!) {
        return 1;
      }

      return -1;
    });
  }

  private loadModuleModifier() {
    this.api.modules.modulesPaths.forEach((modulePath) => {
      const modPath = `${modulePath}/mod.js`;

      if (this.api.utils.fileExists(modPath)) {
        this.loadModifier(require(modPath)(this.api).actions);

        // when the modifier file changes we must reload the entire server
        this.api.config.watchFileAndAct(modPath, () => this.api.commands.restart());
      }
    });
  }

  public async load(): Promise<void> {
    this.api.actions = this;

    this.loadSystemActions();
    this.loadModuleActions();

    // Load the modules after the action in order to reduce the number of operations to apply the group modifications.
    this.loadModuleModifier();

    this.applyGroupModifications();
  }
}
