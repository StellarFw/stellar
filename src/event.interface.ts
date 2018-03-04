/**
 * Type to be used for handle events.
 */
export type EventHandler = (args: any) => void;

/**
 * Interface that represents an event.
 */
export default interface EventInterface {
  event: string;
  priority?: number;
  run: EventHandler;
}
