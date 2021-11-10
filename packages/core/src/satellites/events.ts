import { Satellite, Event, LogLevel, EventHandler, EventContext, Result, err, ok } from "@stellarfw/common/lib";
import * as _ from "lodash";

/**
 * Satellite to manage the Stellar's event system.
 *
 * The developers can use this to manipulate data during the execution or
 * to extend functionalities adding new behaviors to existing logic. The
 * listeners must be stored in <moduleName>/listeners.
 */
export default class EventsSatellite extends Satellite {
  protected _name = "events";
  public loadPriority = 300;

  /**
   * Map with all registered events and listeners.
   */
  private events: Map<string, Array<Event>> = new Map();

  /**
   * Map to keep track of the file listeners.
   */
  private fileListeners: Map<string, Array<Event>> = new Map();

  public async load(): Promise<void> {
    this.api.events = this;

    // load listeners form the active project modules
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
  private listenerObj(listenerObj: Event): Result<number, string> {
    if (listenerObj.event === undefined) {
      return err("Invalid listener - missing event(s) identifier(s)");
    }

    if (listenerObj.run === undefined || typeof listenerObj.run !== "function") {
      return err(`Invalid listener(${listenerObj.event}) - missing run property or not a function`);
    }

    // Assign a default priority value if non is defined
    listenerObj.priority = listenerObj.priority ?? this.api.configs.general.defaultListenerPriority;

    // The event property can be an array, when the listener supports multiple events, so we need to iterate it. When
    // the event property is an string we must convert it to an array in order to simplify the implementation.
    const events = typeof listenerObj.event === "string" ? [listenerObj.event] : listenerObj.event;

    for (const event of events) {
      const listeners = this.events.get(event) ?? [];

      const newListeners = [...listeners, listenerObj];
      // FIXME: can we sort the array just after insert everything?
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      newListeners.sort((l1, l2) => l1.priority! - l2.priority!);

      this.events.set(event, newListeners);
    }

    return ok(events.length);
  }

  /**
   * Register a new listener for an event.
   *
   * @param event Event name.
   * @param fn Listener handler.
   * @param priority Priority.
   * @returns Result value
   */
  public listener(event: string, fn: EventHandler, priority = 100): Result<number, string> {
    const listener: Event = {
      event,
      run: fn,
      priority,
    };

    return this.listenerObj(listener);
  }

  /**
   * Remove all listeners of the given event.
   *
   * @param event name of the event
   */
  public removeAll(event: string) {
    this.events.delete(event);
  }

  /**
   * Fire an event.
   *
   * @param eventName   Event to fire.
   * @param data        Params to pass to the listeners.
   */
  public async fire<T>(eventName: string, data: T): Promise<T> {
    if (!this.events.has(eventName)) {
      return data;
    }

    // when no listener is available just return the given data
    const listeners = this.events.get(eventName);
    if (!listeners) {
      return data;
    }

    // do a deep clone to prevent mutating the original data
    const originalData = _.cloneDeep(data);
    const context: EventContext = {
      api: this.api,
    };

    return listeners.reduce(async (memo, listener) => listener.run(await memo, context), originalData);
  }

  /**
   * Adds a listener to watch for file changes in order to reload
   * the listeners.
   *
   * @param path Path to be watched.
   */
  private watchForChanges(path: string) {
    this.api.config.watchFileAndAct(path, () => {
      this.fileListeners.get(path)?.forEach((listener) => {
        const events = typeof listener.event === "string" ? [listener.event] : listener.event;

        for (const event of events) {
          const listeners = this.events.get(event) ?? [];
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
  public loadFile(path: string, reload = false) {
    const loadMessage = (listener: Event) => {
      const level = reload ? LogLevel.Info : LogLevel.Debug;
      const msg = reload
        ? `listener (re)loaded: ${listener.event}, ${path}`
        : `listener loaded: ${listener.event}, ${path}`;

      this.api.log(msg, level);
    };

    // TODO: convert into async code, so we can make use of the import function
    const collection = require(path) as Array<Event>;

    if (!reload) {
      this.watchForChanges(path);
    }

    const listeners: Array<Event> = [];

    for (const key in collection) {
      if (!collection.hasOwnProperty(key)) {
        continue;
      }

      const listener = collection[key];

      // When there was an error while register the events just log a warning error on the console
      this.listenerObj(listener).tapErr((error) => this.api.log(error, LogLevel.Warning));
      listeners.push(listener);
      loadMessage(listener);
    }

    this.fileListeners.set(path, listeners);
  }

  /**
   * Iterate over all active modules and loads al the listeners.
   */
  private loadListeners() {
    this.api.modules.modulesPaths.forEach((modulePath: string) => {
      const listenersFolderPath = `${modulePath}/listeners`;

      if (!this.api.utils.dirExists(listenersFolderPath)) {
        return;
      }

      // TODO: adapt to support TypeScript modules
      // For each listeners folder load each listener file
      this.api.utils
        .recursiveDirSearch(listenersFolderPath, "js")
        .forEach((listenerPath: string) => this.loadFile(listenerPath));
    });
  }
}
