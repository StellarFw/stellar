import { Option } from "../fp/option/option.types.ts";
import { Result } from "../fp/result/result.interface.ts";
import { API } from "./api.types.ts";
import { LogLevel } from "./engine.types.ts";

export type InputType = "string" | "number" | "object" | "array";

/**
 * Default available formats.
 */
export type ActionFormat = "integer" | "float" | "string";

/**
 * Structure of a format function.
 *
 * Notice that the `origValue` can be from a type other than `T`; so this is insecure.
 */
export type FormatFn<T> = (origValue: unknown, api: API) => T;

/**
 * Action input.
 */
export type ActionInput<T> = {
	/**
	 * Type of the input data.
	 * TODO: need more time to see how I will implement this
	 */
	// type: InputType;

	/**
	 * Description of the input field.
	 */
	description?: string;

	/**
	 * Input default value when there is no provided.
	 */
	default?: T | (() => T);

	/**
	 * When set to true Stellar will force the param to exist.
	 */
	required?: boolean;

	/**
	 * Format function allows to format a parameter.
	 */
	format?: ActionFormat | FormatFn<T>;

	/**
	 * Allows to specify constraints to the input value.
	 */
	validator?: string | RegExp;
};

/**
 * Type for the inputs property.
 */
export type ActionInputMap<K> = {
	[key in keyof K]: ActionInput<K[key]>;
};

/**
 * Action behavior.
 */
export type ActionRunFunction<R, I, E = string> = (
	params: I,
	api: API,
	action: Action<I, R, E>,
) => Promise<Result<R, E>> | Result<R, E>;

export type Action<R, I = unknown, E = string> = {
	/**
	 * A unique action identifier.
	 *
	 * It's recommended to use a namespace to eliminate the possibility
	 * of collision, e.g. `auth.login`.
	 */
	name: string;

	/**
	 * Describes the action.
	 *
	 * This information is used in automatic documentation.
	 */
	description?: string;

	/**
	 * Action version.
	 *
	 * This allow to have multiple action with the same name for
	 * in different versions.
	 */
	version?: number;

	/**
	 * Enumerate the action's input parameters.
	 *
	 * You can also apply restrictions to allowed inputted values.
	 */
	inputs?: ActionInputMap<I>;

	/**
	 * Group which this action is part of.
	 *
	 * This is used to apply batch edits to actions.
	 */
	group?: string;

	/**
	 * Array of middleware to be applied to the action.
	 */
	middleware?: Array<string>;

	/**
	 * Contains an example of an action response.
	 *
	 * This example will be used in automatic documentation.
	 */
	outputExample?: R;

	/**
	 * Block certain types of connections.
	 */
	blockedConnectionTypes?: Array<string>;

	/**
	 * Defines how the action should be logged.
	 */
	logLevel?: LogLevel;

	/**
	 * Allow protect the action against overrides.
	 *
	 * When `true`, prevent the action to be overridden by a higher priority
	 * module.
	 */
	protected?: boolean;

	/**
	 * Prevent action to be called from outside world.
	 */
	private?: boolean;

	/**
	 * Allows set if this action should be parte of the docs.
	 *
	 * By default, this property is set to `true`, otherwise documentation will
	 * not be generated for the action.
	 */
	toDocument?: boolean;

	/**
	 * Dynamic field for actions so its possible to store additional data for them; this can be used by the developers,
	 * modifiers, or even runtime.
	 */
	metadata?: Record<string, unknown>;

	/**
	 * Action logic.
	 */
	run: ActionRunFunction<R, I, E>;

	// -- Internal properties

	/**
	 * Path to the action.
	 *
	 * This is only used internally to know the origen of the action. This should not be used by the end user, and this
	 * will be overwritten by the the core itself.
	 */
	path?: Option<string>;

	// TODO: rethink the ability to extend the action object
	[key: string]: unknown;
};

/**
 * Type used while action is being processed.
 */
export interface ProcessingAction<R, E> extends Action<R, E> {
	params: { [key: string]: unknown };
}
