import { API } from ".";

export interface EventContext {
	api: API;
}

/**
 * Type to be used for handle events.
 */
export type EventHandler = <T, R = T>(args: T, context: EventContext) => Promise<R>;

/**
 * Interface that represents an event.
 */
export interface Event {
	/**
	 * Event that the listener will react to.
	 *
	 * It can also be an array of multiple event names.
	 */
	event: string | Array<string>;

	/**
	 * Event priority.
	 *
	 * When not present Stellar will assign the default one.
	 */
	priority?: number;

	/**
	 * Handler for the event.
	 *
	 * The returned value is the modified data. When exists multiple listeners for the the same event the data is piped
	 * into the next listener.
	 */
	run: EventHandler;
}
