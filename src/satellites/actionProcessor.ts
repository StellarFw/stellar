import { isNotNil } from "ramda-adjunct";
import { err, ok } from "../common/fp/result/result.ts";
import { API } from "../common/types/api.types.ts";
import { Connection } from "../connection.ts";
import { Action } from "../common/types/action.type.ts";
import { Result } from "../common/fp/result/result.interface.ts";
import { UnknownActionException } from "../common/exceptions/unknown-action.exception.ts";
import { last } from "ramda";
import { EngineStatus } from "../common/types/engine.types.ts";
import { ExecutionTimeoutException } from "../common/exceptions/executionTimeout.exception.ts";

enum ActionStatus {
	NOT_PROCESSED = "not_processed",
	SERVER_ERROR = "server_error",
	SERVER_SHUTTING_DOWN = "server_shutting_down",
	TOO_MANY_REQUESTS = "too_many_requests",
	UNKNOWN_ACTION = "unknown_action",
	UNSUPPORTED_SERVER_TYPE = "unsupported_server_type",
	VALIDATOR_ERRORS = "validator_errors",
	RESPONSE_TIMEOUT = "response_timeout",
	OTHER = "other",
}

type Params = {
	/**
	 * Version of the action to be executed.
	 */
	apiVersion?: number;

	[key: string]: unknown;
};

/**
 * This class process an action request.
 */
class ActionProcessor {
	/**
	 * API reference.
	 */
	api: API;

	connection: Connection<unknown>;

	/**
	 * Name of the action being executed.
	 */
	actionName!: string;

	toProcess = true;
	toRender = true;

	/**
	 * Message identifier.
	 */
	messageCount = 0;

	params: Params = {};
	validatorErrors = new Map();

	/**
	 * Timestamp when the action was started to be processed.
	 */
	actionStartTime!: number;

	actionTemplate!: Action<unknown>;

	working = false;

	/**
	 * Action response.
	 */
	response?: Result<unknown, unknown>;

	/**
	 * Duration that the action took to be completed.
	 */
	duration: number = 0;

	/**
	 * Timer that is used to timeout the action call.
	 */
	timeoutTimer?: number;

	/**
	 * When this flag is set to true we block any after response.
	 *
	 * This is essential used when a timeout happens.
	 */
	errorRendered = false;

	/**
	 * Create a new Action Processor instance.
	 *
	 * @param api API reference.
	 * @param connection Connection object.
	 */
	constructor(api: API, connection: Connection<unknown>) {
		this.api = api;
		this.connection = connection;
		this.messageCount = connection.messageCount;
		this.params = connection.params;
	}

	/**
	 * Increment the total number of executed actions for this connection.
	 *
	 * @param count
	 */
	incrementTotalActions(count = 1) {
		this.connection.totalActions += count;
	}

	/**
	 * Increment the pending actions for this connection.
	 *
	 * @param count
	 */
	incrementPendingActions(count = 1) {
		this.connection.pendingActions += count;
	}

	/**
	 * Get the number of pending action for this connection.
	 */
	getPendingActionCount() {
		return this.connection.pendingActions;
	}

	/**
	 * Complete the action execution.
	 *
	 * This essentially logs the action execution status.
	 *
	 * @param status
	 */
	completeAction(status?: ActionStatus, incomeError?: Error | string): ActionProcessor {
		let error = incomeError ?? null;

		switch (status) {
			case ActionStatus.SERVER_ERROR:
				error = this.api.config.errors.serverErrorMessage;
				break;
			case ActionStatus.SERVER_SHUTTING_DOWN:
				error = this.api.config.errors.serverShuttingDown;
				break;
			case ActionStatus.TOO_MANY_REQUESTS:
				error = this.api.config.errors.tooManyPendingActions();
				break;
			case ActionStatus.UNKNOWN_ACTION:
				error = this.api.config.errors.unknownAction(this.actionName);
				break;
			case ActionStatus.UNSUPPORTED_SERVER_TYPE:
				error = this.api.config.errors.unsupportedServerType(
					this.connection.type,
				);
				break;
			case ActionStatus.VALIDATOR_ERRORS:
				error = this.api.config.errors.invalidParams(this.validatorErrors);
				break;
			case ActionStatus.RESPONSE_TIMEOUT:
				error = this.api.config.errors.responseTimeout(this.actionName);
				break;
		}

		if (error && typeof error === "string") {
			error = new Error(error);
		}

		if (error && !this.response?.isErr()) {
			this.response = err(error);
		}

		this.incrementPendingActions(-1);
		this.duration = new Date().getTime() - this.actionStartTime;

		this.working = false;
		this.logAction(error);

		return this;
	}

	/**
	 * Log the action execution.
	 *
	 * @param error
	 */
	logAction(error) {
		let logLevel = "info";

		// check if the action have a specific log level
		if (this.actionTemplate && this.actionTemplate.logLevel) {
			logLevel = this.actionTemplate.logLevel;
		}

		const filteredParams = {};
		for (const i in this.params) {
			if (
				this.api.config.general.filteredParams &&
				this.api.config.general.filteredParams.indexOf(i) >= 0
			) {
				filteredParams[i] = "[FILTERED]";
			} else if (typeof this.params[i] === "string") {
				filteredParams[i] = this.params[i].substring(
					0,
					this.api.config.logger.maxLogStringLength,
				);
			} else {
				filteredParams[i] = this.params[i];
			}
		}

		const logLine = {
			to: this.connection.remoteIP,
			action: this.actionName,
			params: JSON.stringify(filteredParams),
			duration: this.duration,
		};

		if (error) {
			if (error instanceof Error) {
				logLine.error = String(error);
			} else {
				try {
					logLine.error = JSON.stringify(error);
				} catch (e) {
					logLine.error = String(error);
				}
			}
		}

		// log the action execution
		this.api.log(`[ action @  ${this.connection.type}]`, logLevel, logLine);
	}

	/**
	 * Operations to be performed before the real action execution.
	 */
	async preProcessAction() {
		// if the action is private this can only be executed internally
		if (
			this.actionTemplate.private === true &&
			this.connection.type !== "internal"
		) {
			throw this.api.config.errors.privateActionCalled(this.actionTemplate.name);
		}

		const processorsNames = this.api.actions.globalMiddleware.slice(0);

		// get action processor names
		if (this.actionTemplate.middleware) {
			this.actionTemplate.middleware.forEach((m) => {
				processorsNames.push(m);
			});
		}

		for (const name of processorsNames) {
			if (
				typeof this.api.actions.middleware[name].preProcessor === "function"
			) {
				await this.api.actions.middleware[name].preProcessor(this);
			}
		}

		return ok(null);
	}

	/**
	 * Operations to be performed after the action execution.
	 */
	postProcessAction() {
		const processors = [];
		const processorNames = this.api.actions.globalMiddleware.slice(0);

		if (this.actionTemplate.middleware) {
			this.actionTemplate.middleware.forEach((m) => {
				processorNames.push(m);
			});
		}

		for (const name of processorNames) {
			if (
				typeof this.api.actions.middleware[name].postProcessor === "function"
			) {
				processors.push((next) => {
					this.api.actions.middleware[name].postProcessor(this);
				});
			}
		}
	}

	/**
	 * Validate call params with the action requirements.
	 */
	validateParams() {
		// hash who contains all the field to be validated
		const toValidate = {};

		// iterate inputs definitions of the called action
		for (const key in this.actionTemplate.inputs) {
			// get input properties
			const props = this.actionTemplate.inputs[key];

			// default
			if (this.params[key] === undefined && props.default !== undefined) {
				if (typeof props.default === "function") {
					this.params[key] = props.default(this.api, this);
				} else {
					this.params[key] = props.default;
				}
			}

			// format the input to the requested type
			if (props.format && this.params[key]) {
				if (typeof props.format === "function") {
					this.params[key] = props.format.call(
						this.api,
						this.params[key],
						this,
					);
				} else if (props.format === "integer") {
					this.params[key] = Number.parseInt(this.params[key]);
				} else if (props.format === "float") {
					this.params[key] = Number.parseFloat(this.params[key]);
				} else if (props.format === "string") {
					this.params[key] = String(this.params[key]);
				}

				if (Number.isNaN(this.params[key])) {
					this.validatorErrors.set(
						key,
						this.api.config.errors.paramInvalidType(key, props.format),
					);
				}
			}

			// convert the required property to a validator to unify the validation
			// system
			if (props.required === true) {
				// FIXME: this will throw an error when the validator is a function
				props.validator = !props.validator ? "required" : `required|${props.validator}`;
			}

			// add the field to the validation hash
			if (props.validator) {
				toValidate[key] = props.validator;
			}
		}

		// execute all validators. If there is found some error on the validations,
		// the error map must be attributed to `validatorErrors`
		const response = this.api.validator.validate(this.params, toValidate);
		if (response !== true) {
			this.validatorErrors = response;
		}
	}

	private setupActionTemplate(): Result<true, UnknownActionException> {
		const actionVersions = this.api.actions.versions.get(this.actionName);
		if (!actionVersions) {
			return err(new UnknownActionException());
		}

		// use the latest action version when no version is specified
		if (!this.params.apiVersion) {
			this.params.apiVersion = last(actionVersions);
		}

		this.actionTemplate = this.api.actions.actions[this.actionName][this.params.apiVersion!];
		return ok(true);
	}

	/**
	 * Process the action.
	 */
	processAction(): ActionProcessor | Promise<ActionProcessor | undefined> {
		// initialize the processing environment
		this.actionStartTime = new Date().getTime();
		this.working = true;
		this.incrementTotalActions();
		this.incrementPendingActions();
		this.actionName = String(this.params.action);

		// setup the template and checks if the requested action exists
		if (this.setupActionTemplate().isErr()) {
			return this.completeAction(ActionStatus.UNKNOWN_ACTION);
		}

		if (this.api.status !== EngineStatus.Running) {
			return this.completeAction(ActionStatus.SERVER_SHUTTING_DOWN);
		} else if (
			this.getPendingActionCount() >
				this.api.config.general.simultaneousActions
		) {
			return this.completeAction(ActionStatus.TOO_MANY_REQUESTS);
		} else if (
			this.actionTemplate.blockedConnectionTypes &&
			this.actionTemplate.blockedConnectionTypes.includes(
				this.connection.type,
			)
		) {
			return this.completeAction(ActionStatus.UNSUPPORTED_SERVER_TYPE);
		}

		try {
			return this.runAction();
		} catch (error) {
			this.api.exceptionHandlers.action(error, this);
			return this.completeAction(ActionStatus.SERVER_ERROR);
		}
	}

	/**
	 * Run an action.
	 */
	async runAction() {
		try {
			await this.preProcessAction();

			// validate the request params with the action requirements
			this.validateParams();
		} catch (error) {
			return this.completeAction(ActionStatus.SERVER_ERROR, error as Error);
		}

		if (this.validatorErrors.size > 0) {
			return this.completeAction(ActionStatus.VALIDATOR_ERRORS);
		}

		if (!this.toProcess) {
			return this.completeAction();
		}

		// create a timer that will be used to timeout the action if needed. The time timeout is reached a timeout error
		// is sent to the client.
		const timeoutPromise = new Promise<Result<unknown>>((_, rejects) => {
			this.timeoutTimer = setTimeout(() => {
				rejects(new ExecutionTimeoutException());
			}, this.api.config.general.actionTimeout);
		});

		try {
			const actionPromise = this.actionTemplate.run(this.params, this.api, this.actionTemplate);
			this.response = await Promise.race([timeoutPromise, actionPromise]);

			// when the error rendered flag is set we don't send a response
			if (this.errorRendered) {
				return;
			}

			// post process the action
			const postProcessResponse = await this.postProcessAction();
			if (isNotNil(postProcessResponse)) {
				Object.assign(this.response, postProcessResponse);
			}

			return this.completeAction();
		} catch (error) {
			// when the error rendered flag is set we don't send a response
			if (this.errorRendered) {
				return;
			}

			if (error instanceof ExecutionTimeoutException) {
				// TODO: should we modify the completeAction to set this to true when an error happens?
				this.errorRendered = true;
				return this.completeAction(ActionStatus.RESPONSE_TIMEOUT);
			}

			// complete the action with an error message
			return this.completeAction(undefined, error as Error);
		} finally {
			// since the action can also fail we need to resolve the
			clearTimeout(this.timeoutTimer);
		}
	}
}

/**
 * Action processor Satellite.
 */
export default class {
	/**
	 * Initializer load priority.
	 *
	 * @type {number}
	 */
	loadPriority = 430;

	/**
	 * Satellite loading function.
	 *
	 * @param api   API reference object.
	 */
	async load(api) {
		api.actionProcessor = ActionProcessor;
	}
}
