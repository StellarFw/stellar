import { Action, err, asyncAlways, ActionInput, ActionRunFunction, ActionInputMap } from "..";

/**
 * Creates a new Action.
 */
export function createAction<R, I extends ActionInputMap>(name: string, description?: string) {
  return {
    name,
    description,
    version: 1,
    inputs: {} as I,
    run: asyncAlways(err("Action body not defined!")),
  } as Action<R, I>;
}

/**
 * Generate a function that sets the given input on an Action.
 */
export function input<T>(name: string, meta: ActionInput<T>) {
  return <R, I, E>(action: Action<R, I, E>): Action<R, I, E> => ({
    ...action,
    inputs: { ...action.inputs, [name]: meta } as ActionInputMap,
  });
}

/**
 * Allows to define the behaviour of an action.
 */
export function behavior<actionBehavior, I, E>(actionBehavior: ActionRunFunction<actionBehavior, I, E>) {
  return (action: Action<actionBehavior, I, E>): Action<actionBehavior, I, E> => ({
    ...action,
    run: actionBehavior as ActionRunFunction<actionBehavior, I, E>,
  });
}
