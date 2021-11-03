/**
 * Type to be used for handle events.
 */
export type EventHandler = (args: any) => void;

/**
 * Interface that represents an event.
 */
export default interface EventInterface {
  /**
   * Event that the listener will react to.
   */
  event: string;

  priority?: number;

  run: EventHandler;
};;;;;;;;;;;;;;;;;;;;
