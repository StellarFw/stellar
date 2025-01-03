import { EventEmitter } from "node:events";

/**
 * This function is called when the method is not implemented.
 */
let methodNotDefined = () => {
	throw new Error("The containing method should be defined for this server type");
};

/**
 * This is the prototypical generic server class that all other types
 * of servers inherit from.
 */
export default class GenericServer extends EventEmitter {
	/**
	 * API object reference.
	 */
	api;

	/**
	 * Connection type.
	 */
	type;

	/**
	 * Connection options.
	 */
	options;

	/**
	 * Connection attributes.
	 */
	attributes;

	/**
	 * Constructor.
	 *
	 * @param api
	 * @param name
	 * @param options
	 * @param attributes
	 */
	constructor(api, name, options, attributes) {
		// call super class constructor
		super();

		this.api = api;
		this.type = name;
		this.options = options;
		this.attributes = attributes;

		// attributes can be overwritten by the options
		for (let key in this.options) {
			if (this.attributes[key] !== null && this.attributes[key] !== undefined) {
				this.attributes[key] = this.options[key];
			}
		}
	}

	/**
	 * Build a new connection object.
	 *
	 * @param data Connection data.
	 */
	buildConnection(data) {
		let details = {
			type: this.type,
			id: data.id,
			remotePort: data.remotePort,
			remoteIP: data.remoteAddress,
			rawConnection: data.rawConnection,
		};

		// if the server canChat enable the flag on the connection
		if (this.attributes.canChat === true) {
			details.canChat = true;
		}

		// if the connection doesn't have a fingerprint already create one
		if (data.fingerprint) {
			details.fingerprint = data.fingerprint;
		}

		// get connection class
		let ConnectionClass = this.api.connection;

		// create a new connection instance
		let connection = new ConnectionClass(this.api, details);

		// define sendMessage method
		connection.sendMessage = (message) => {
			this.sendMessage(connection, message);
		};

		// define sendFile method
		connection.sendFile = (path) => {
			connection.params.file = path;
			this.processFile(connection);
		};

		// emit the new connection object
		this.emit("connection", connection);

		// check if the lod for this type of connection is active
		if (this.attributes.logConnections === true) {
			this.log("new connection", "info", { to: connection.remoteIP });
		}

		// bidirectional connection can have a welcome message
		if (this.attributes.sendWelcomeMessage === true) {
			connection.sendMessage({
				welcome: this.api.config.general.welcomeMessage,
				context: "api",
			});
		}

		if (typeof this.attributes.sendWelcomeMessage === "number") {
			setTimeout(() => {
				try {
					connection.sendMessage({
						welcome: this.api.config.general.welcomeMessage,
						context: "api",
					});
				} catch (e) {
					this.api.log.error(e);
				}
			}, this.attributes.sendWelcomeMessage);
		}
	}

	/**
	 * Process an action request.
	 *
	 * @param connection Connection object.
	 */
	processAction(connection) {
		// create a new action processor instance for this request
		const ActionProcessor = this.api.actionProcessor;
		let actionProcessor = new ActionProcessor(this.api, connection, (data) => {
			this.emit("actionComplete", data);
		});

		// process the request
		actionProcessor.processAction();
	}

	/**
	 * Process a file request.
	 *
	 * @param connection Connection object.
	 */
	processFile(connection) {
		this.api.staticFile.get(connection, (connection, error, fileStream, mime, length, lastModified) => {
			this.sendFile(connection, error, fileStream, mime, length, lastModified);
		});
	}

	/**
	 * Get all active connection of this server.
	 *
	 * This don't work in some type of servers.
	 *
	 * @returns {Array}
	 */
	connections() {
		let _connections = [];

		for (let i in this.api.connections.connections) {
			let connection = this.api.connections.connections[i];
			if (connection.type === this.type) {
				_connections.push(connection);
			}
		}

		return _connections;
	}

	/**
	 * Log function.
	 *
	 * @param message   Message to be logged.
	 * @param severity  Severity level.
	 * @param data      Additional data to be printed out.
	 */
	log(message, severity, data) {
		this.api.log(`[Server: ${this.type}] ${message}`, severity, data);
	}

	/**
	 * Invoked as part of boot.
	 */
	start() {
		methodNotDefined();
	}

	/**
	 * Invoked as part of shutdown.
	 */
	stop() {
		methodNotDefined();
	}

	/**
	 * This method will be appended to the connection as 'connection.sendMessage'
	 *
	 * @param connection  Connection object.
	 * @param message     Message be sent back to the client.
	 */
	sendMessage() {
		methodNotDefined();
	}

	/**
	 * This method will be used to gracefully disconnect the client.
	 *
	 * @param connection  Connection object.
	 * @param reason      Reason for disconnection.
	 */
	goodbye() {
		methodNotDefined();
	}
}
