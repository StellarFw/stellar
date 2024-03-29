import async from "async";

/**
 * This class process an action request.
 */
class ActionProcessor {
	/**
	 * API reference.
	 *
	 * @type {null}
	 */
	api = null;

	connection = null;
	action = null;
	toProcess = true;
	toRender = true;
	messageCount = null;
	params = null;
	callback = null;
	validatorErrors = new Map();
	actionStartTime = null;
	actionTemplate = null;
	working = false;
	response = {};
	duration = null;
	actionStatus = null;

	/**
	 * Timer that is used to timeout the action call.
	 */
	timeoutTimer = null;

	/**
	 * When this flag is set to true we block any after response.
	 *
	 * This is essential used when a timeout happens.
	 *
	 * @type {boolean}
	 */
	errorRendered = false;

	/**
	 * Create a new Action Processor instance.
	 *
	 * @param api API reference.
	 * @param connection Connection object.
	 * @param callback Callback function.
	 */
	constructor(api, connection, callback) {
		this.api = api;
		this.connection = connection;
		this.messageCount = connection.messageCount;
		this.params = connection.params;
		this.callback = callback;
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
	 *
	 * @returns {number|*}
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
	completeAction(status) {
		let error = null;

		// define the action status
		this.actionStatus = String(status);

		if (status instanceof Error) {
			error = status;
		} else if (status === "server_error") {
			error = this.api.config.errors.serverErrorMessage;
		} else if (status === "server_shutting_down") {
			error = this.api.config.errors.serverShuttingDown;
		} else if (status === "too_many_requests") {
			error = this.api.config.errors.tooManyPendingActions();
		} else if (status === "unknown_action") {
			error = this.api.config.errors.unknownAction(this.action);
		} else if (status === "unsupported_server_type") {
			error = this.api.config.errors.unsupportedServerType(this.connection.type);
		} else if (status === "validator_errors") {
			error = this.api.config.errors.invalidParams(this.validatorErrors);
		} else if (status === "response_timeout") {
			error = this.api.config.errors.responseTimeout(this.action);
		} else if (status) {
			error = status;
		}

		if (error && typeof error === "string") {
			error = new Error(error);
		}

		if (error && !this.response.error) {
			if (typeof this.response === "string" || Array.isArray(this.response)) {
				this.response = error.toString();
			} else {
				this.response.error = error;
			}
		}

		this.incrementPendingActions(-1);
		this.duration = new Date().getTime() - this.actionStartTime;

		process.nextTick(() => {
			if (typeof this.callback === "function") {
				this.callback(this);
			}
		});

		this.working = false;
		this.logAction(error);
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

		let filteredParams = {};
		for (let i in this.params) {
			if (this.api.config.general.filteredParams && this.api.config.general.filteredParams.indexOf(i) >= 0) {
				filteredParams[i] = "[FILTERED]";
			} else if (typeof this.params[i] === "string") {
				filteredParams[i] = this.params[i].substring(0, this.api.config.logger.maxLogStringLength);
			} else {
				filteredParams[i] = this.params[i];
			}
		}

		let logLine = {
			to: this.connection.remoteIP,
			action: this.action,
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
	 *
	 * @param callback Callback function.
	 */
	preProcessAction(callback) {
		// if the action is private this can only be executed internally
		if (this.actionTemplate.private === true && this.connection.type !== "internal") {
			callback(this.api.config.errors.privateActionCalled(this.actionTemplate.name));
			return;
		}

		let processors = [];
		let processorsNames = this.api.actions.globalMiddleware.slice(0);

		// get action processor names
		if (this.actionTemplate.middleware) {
			this.actionTemplate.middleware.forEach((m) => {
				processorsNames.push(m);
			});
		}

		processorsNames.forEach((name) => {
			if (typeof this.api.actions.middleware[name].preProcessor === "function") {
				processors.push((next) => {
					this.api.actions.middleware[name].preProcessor(this, next);
				});
			}
		});

		async.series(processors, callback);
	}

	/**
	 * Operations to be performed after the action execution.
	 *
	 * @param callback
	 */
	postProcessAction(callback) {
		let processors = [];
		let processorNames = this.api.actions.globalMiddleware.slice(0);

		if (this.actionTemplate.middleware) {
			this.actionTemplate.middleware.forEach((m) => {
				processorNames.push(m);
			});
		}

		processorNames.forEach((name) => {
			if (typeof this.api.actions.middleware[name].postProcessor === "function") {
				processors.push((next) => {
					this.api.actions.middleware[name].postProcessor(this, next);
				});
			}
		});

		async.series(processors, callback);
	}

	/**
	 * Validate call params with the action requirements.
	 */
	validateParams() {
		// hash who contains all the field to be validated
		const toValidate = {};

		// iterate inputs definitions of the called action
		for (let key in this.actionTemplate.inputs) {
			// get input properties
			let props = this.actionTemplate.inputs[key];

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
					this.params[key] = props.format.call(this.api, this.params[key], this);
				} else if (props.format === "integer") {
					this.params[key] = Number.parseInt(this.params[key]);
				} else if (props.format === "float") {
					this.params[key] = Number.parseFloat(this.params[key]);
				} else if (props.format === "string") {
					this.params[key] = String(this.params[key]);
				}

				if (Number.isNaN(this.params[key])) {
					this.validatorErrors.set(key, this.api.config.errors.paramInvalidType(key, props.format));
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
		let response = this.api.validator.validate(this.params, toValidate);
		if (response !== true) {
			this.validatorErrors = response;
		}
	}

	/**
	 * Process the action.
	 */
	processAction() {
		// initialize the processing environment
		this.actionStartTime = new Date().getTime();
		this.working = true;
		this.incrementTotalActions();
		this.incrementPendingActions();
		this.action = this.params.action;

		if (this.api.actions.versions[this.action]) {
			if (!this.params.apiVersion) {
				this.params.apiVersion =
					this.api.actions.versions[this.action][this.api.actions.versions[this.action].length - 1];
			}
			this.actionTemplate = this.api.actions.actions[this.action][this.params.apiVersion];
		}

		if (this.api.status !== "running") {
			this.completeAction("server_shutting_down");
		} else if (this.getPendingActionCount(this.connection) > this.api.config.general.simultaneousActions) {
			this.completeAction("too_many_requests");
		} else if (!this.action || !this.actionTemplate) {
			this.completeAction("unknown_action");
		} else if (
			this.actionTemplate.blockedConnectionTypes &&
			this.actionTemplate.blockedConnectionTypes.indexOf(this.connection.type) >= 0
		) {
			this.completeAction("unsupported_server_type");
		} else {
			try {
				this.runAction();
			} catch (err) {
				this.api.exceptionHandlers.action(err, this, () => this.completeAction("server_error"));
			}
		}
	}

	/**
	 * Run an action.
	 */
	runAction() {
		this.preProcessAction((error) => {
			// validate the request params with the action requirements
			this.validateParams();

			if (error) {
				this.completeAction(error);
			} else if (this.validatorErrors.size > 0) {
				this.completeAction("validator_errors");
			} else if (this.toProcess === true && !error) {
				// create a timer that will be used to timeout the action if needed. The time timeout is reached a timeout error
				// is sent to the client.
				this.timeoutTimer = setTimeout(() => {
					// finish action with a timeout error
					this.completeAction("response_timeout");

					// ensure that the action wouldn't respond
					this.errorRendered = true;
				}, this.api.config.general.actionTimeout);

				// execute the action logic
				const returnVal = this.actionTemplate.run(this.api, this, (error) => {
					// stop the timeout timer
					clearTimeout(this.timeoutTimer);

					// when the error rendered flag is set we don't send a response
					if (this.errorRendered) {
						return;
					}

					// catch the error messages and send to the client an error as a response
					if (error) {
						return this.completeAction(error);
					}

					// execute the post action process
					this.postProcessAction((error) => this.completeAction(error));
				});

				// if the returnVal is a Promise we wait for the resolve/rejection and
				// after that we finish the action execution
				if (returnVal && typeof returnVal.then === "function") {
					returnVal
						// execute the post action process
						.then(() => {
							// when the error rendered flag is set we don't send a response
							if (this.errorRendered) {
								return;
							}

							// post process the action
							this.postProcessAction((error) => this.completeAction(error));
						})

						// catch error responses
						.catch((error) => {
							// when the error rendered flag is set we don't send a response
							if (this.errorRendered) {
								return;
							}

							// complete the action with an error message
							this.completeAction(error);
						})

						// stop the timeout timer
						.then(() => clearTimeout(this.timeoutTimer));
				}
			} else {
				this.completeAction();
			}
		});
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
