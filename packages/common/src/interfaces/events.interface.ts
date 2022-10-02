import { Result } from "../fp/result/index";
import { EventHandler } from "./event.interface";

export interface IEventsSatellite {
	/**
	 * Register a new listener for an event.
	 *
	 * @param event Event name.
	 * @param fn Listener handler.
	 * @param priority Priority.
	 * @returns Result value
	 */
	listener(event: string, fn: EventHandler, priority?: number): Result<number, string>;

	/**
	 * Remove all listeners of the given event.
	 *
	 * @param event name of the event
	 */
	removeAll(event: string): void;

	/**
	 * Fire an event.
	 *
	 * @param eventName   Event to fire.
	 * @param data        Params to pass to the listeners.
	 */
	fire<T>(eventName: string, data: T): Promise<T>;

	/**
	 * Load a listener file.
	 *
	 * @param path Path listener.
	 * @param reload When set to true that means that is a reload.
	 */
	loadFile(path: string, reload?: boolean): void;
}
