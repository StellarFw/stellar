import { Action, err, asyncAlways, ActionInput, ActionRunFunction, ActionInputMap } from "..";

/**
 * Creates a new Action.
 */
export function createAction<R, I extends ActionInputMap>(name: string, description?: string) {
  return {
    name,
    description,
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
export function behaviour<R, I, E>(actionBehaviour: ActionRunFunction<R, I, E>) {
  return (action: Action<R, I, E>): Action<R, I, E> => ({
    ...action,
    run: actionBehaviour as ActionRunFunction<R, I, E>,
  });
}
