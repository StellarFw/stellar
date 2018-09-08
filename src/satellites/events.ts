import { Satellite } from "../satellite";
import * as _ from "lodash";
import EventInterface, { EventHandler } from "../event.interface";
import { LogLevel } from "../log-level.enum";

/**
 * Satellite to manage the Stellar's event system.
 *
 * The developers can use this to manipulate data during the execution or
 * to extend functionalities adding new behaviors to existing logic. The
 * listeners must be stored in <moduleName>/listeners.
 */
export default class EventsSatellite extends Satellite {
  protected _name: string = "events";
  public loadPriority: number = 300;

  /**
   * Map with all registered events and listeners.
   */
  private events: Map<string, Array<EventInterface>> = new Map();

  /**
   * Map to keep track of the file listeners.
   */
  private fileListeners: Map<string, Array<EventInterface>> = new Map();

  public async load(): Promise<void> {
    this.api.events = this;
    this.loadListeners();
  }

  /**
   * Insert the listener object into the Map.
   *
   * The error messages are logged to the console, like warning.
   *
   * @param listenerObj Listener object.
   * @returns True if is all okay, false otherwise.
   */
  private listenerObj(listenerObj: EventInterface) {
    if (listenerObj.event === undefined) {
      this.api.log("Invalid listener - missing event name", LogLevel.Warning);
      return false;
    }

    if (
      listenerObj.run === undefined ||
      typeof listenerObj.run !== "function"
    ) {
      this.api.log(
        "Invalid listener - missing run property or not a function",
        LogLevel.Warning,
      );
      return false;
    }

    if (listenerObj.priority === undefined) {
      listenerObj.priority = this.api.configs.general.defaultListenerPriority;
    }

    // The event property can be an array, when the listener supports multiple
    // events, so we need to iterate it. When the event property is an string we
    // must convert it to an array in order to simplify the implementation.
    const events =
      typeof listenerObj.event === "string"
        ? [listenerObj.event]
        : listenerObj.event;

    for (const event of events) {
      if (!this.events.has(event)) {
        this.events.set(event, []);
      }

      const listeners = this.events.get(event);
      listeners.push(listenerObj);
      listeners.sort((l1, l2) => l1.priority - l2.priority);
    }

    return true;
  }

  /**
   * Register a new listener for an event.
   *
   * @param event Event name.
   * @param fn Listener handler.
   * @param priority Priority.
   */
  public listener(event: string, fn: EventHandler, priority: number = 100) {
    const listener = {
      event,
      run: fn,
      priority,
    } as EventInterface;

    this.listenerObj(listener);
  }

  /**
   * Fire an event.
   *
   * @param eventName   Event to fire.
   * @param data        Params to pass to the listeners.
   */
  public async fire(eventName: string, data: any): Promise<any> {
    if (!this.events.has(eventName)) {
      return data;
    }

    const responseData = _.cloneDeep(data);
    const listeners = this.events.get(eventName);

    const context = {
      api: this.api,
    };

    for (const listener of listeners) {
      await listener.run.call(context, responseData);
    }

    return responseData;
  }

  /**
   * Adds a listener to watch for file changes in order to reload
   * the listeners.
   *
   * @param path Path to be watched.
   */
  private watchForChanges(path: string) {
    this.api.config.watchFileAndAct(path, () => {
      this.fileListeners.get(path).forEach(listener => {
        const events =
          typeof listener.event === "string"
            ? [listener.event]
            : listener.event;

        for (const event of events) {
          const listeners = this.events.get(event);
          const index = listeners.indexOf(listener);
          listeners.splice(index, 1);
        }
      });

      this.loadFile(path, true);
    });
  }

  /**
   * Load a listener file.
   *
   * @param path Path listener.
   * @param reload When set to true that means that is a reload.
   */
  public loadFile(path: string, reload: boolean = false) {
    const loadMessage = listener => {
      const level = reload ? LogLevel.Info : LogLevel.Debug;
      let msg = null;

      if (reload) {
        msg = `listener (re)loaded: ${listener.event}, ${path}`;
      } else {
        msg = `listener loaded: ${listener.event}, ${path}`;
      }

      this.api.log(msg, level);
    };

    const collection = require(path);

    if (!reload) {
      this.watchForChanges(path);
    }

    const listeners = [];

    for (const key in collection) {
      if (!collection.hasOwnProperty(key)) {
        continue;
      }

      const listener = collection[key];

      this.listenerObj(listener);
      listeners.push(listener);
      loadMessage(listener);
    }

    this.fileListeners.set(path, listeners);
  }

  /**
   * Iterate over all active modules and loads al the listeners.
   */
  private loadListeners() {
    this.api.modules.modulesPaths.forEach(modulePath => {
      const listenersFolderPath = `${modulePath}/listeners`;

      if (!this.api.utils.dirExists(listenersFolderPath)) {
        return;
      }

      this.api.utils
        .recursiveDirSearch(listenersFolderPath, "js")
        .forEach(listenerPath => this.loadFile(listenerPath));
    });
  }
}
