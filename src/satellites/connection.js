import { randomUUID } from "crypto";

/**
 * Create a clean connection.
 *
 * @param connection  Connection object.
 * @returns {{}}      New clean connection object.
 */
let cleanConnection = (connection) => {
	let clean = {};

	for (let i in connection) {
		if (i !== "rawConnection") {
			clean[i] = connection[i];
		}
	}

	return clean;
};

class Connections {
	/**
	 * API reference object.
	 */
	api;

	/**
	 * Hash with all registered middleware.
	 *
	 * @type {{}}
	 */
	middleware = {};

	/**
	 * Array with global middleware.
	 *
	 * @type {Array}
	 */
	globalMiddleware = [];

	/**
	 * Array with the allowed verbs.
	 *
	 * @type {string[]}
	 */
	allowedVerbs = [
		"quit",
		"exit",
		"paramAdd",
		"paramDelete",
		"paramView",
		"paramsView",
		"paramsDelete",
		"roomJoin",
		"roomLeave",
		"roomView",
		"detailsView",
		"say",
		"event",
	];

	/**
	 * Hash with the active connections.
	 *
	 * @type {{}}
	 */
	connections = {};

	/**
	 * Create a new class instance.
	 *
	 * @param api   API object reference.
	 */
	constructor(api) {
		this.api = api;
	}

	/**
	 * Add a new middleware.
	 *
	 * @param data  Middleware to be added.
	 */
	addMiddleware(data) {
		// middleware require a name
		if (!data.name) {
			throw new Error("middleware.name is required");
		}

		// if there is no defined priority use the default
		if (!data.priority) {
			data.priority = this.api.config.general.defaultMiddlewarePriority;
		}

		// ensure the priority is a number
		data.priority = Number(data.priority);

		// save the new middleware
		this.middleware[data.name] = data;

		// push the new middleware to the global list
		this.globalMiddleware.push(data.name);

		// sort the global middleware array
		this.globalMiddleware.sort((a, b) => {
			if (this.middleware[a].priority > this.middleware[b].priority) {
				return 1;
			}

			return -1;
		});
	}

	apply(connectionId, method, args, callback) {
		if (args === undefined && callback === undefined && typeof method === "function") {
			callback = method;
			args = null;
			method = null;
		}

		this.api.redis._doCluster("api.connections.applyCatch", [connectionId, method, args], connectionId, callback);
	}

	applyCatch(connectionId, method, args, callback) {
		const connection = this.api.connections.connections[connectionId];

		if (method && args) {
			if (method === "sendMessage" || method === "sendFile") {
				connection[method](args);
			} else {
				connection[method].apply(connection, args);
			}
		}

		if (typeof callback === "function") {
			process.nextTick(() => {
				callback(cleanConnection(connection));
			});
		}
	}
}

/**
 * Class who represents an active connection.
 */
class Connection {
	/**
	 * Api reference.
	 */
	api;

	/**
	 * Unique client identifier.
	 */
	id;

	/**
	 * Timestamp of the connection.
	 */
	connectedAt;

	/**
	 * Rooms which the client belongs.
	 *
	 * @type {Array}
	 */
	rooms = [];

	/**
	 * Create a new connection object.
	 *
	 * The data object needs to have the follow properties:
	 *  - type
	 *  - remotePort
	 *  - remoteIP
	 *  - rawConnection
	 *
	 * @param api Stellar API reference
	 * @param data hash map
	 */
	constructor(api, data) {
		this.api = api;
		this._setup(data);

		// save this connection on the connection manager
		api.connections.connections[this.id] = this;

		// execute the middleware
		this.api.connections.globalMiddleware.forEach((middlewareName) => {
			if (typeof this.api.connections.middleware[middlewareName].create === "function") {
				this.api.connections.middleware[middlewareName].create(this);
			}
		});
	}

	/**
	 * Initialize the connection object.
	 *
	 * @param data
	 * @private
	 */
	_setup(data) {
		if (data.id) {
			this.id = data.id;
		} else {
			// generate an unique ID for this connection
			this.id = this._generateID();
		}

		// set the connection timestamp
		this.connectedAt = new Date().getTime();

		let requiredFields = ["type", "rawConnection"];

		requiredFields.forEach((req) => {
			if (data[req] === null || data[req] === undefined) {
				throw new Error(`${req} is required to create a new connection object`);
			}
			this[req] = data[req];
		});

		let enforcedConnectionProperties = ["remotePort", "remoteIP"];

		enforcedConnectionProperties.forEach((req) => {
			if (data[req] === null || data[req] === undefined) {
				if (this.api.config.general.enforceConnectionProperties === true) {
					throw new Error(`${req} is required to create a new connection object`);
				} else {
					data[req] = 0; // could be a random uuid as well?
				}
			}
			this[req] = data[req];
		});

		// set connection defaults
		let connectionDefaults = {
			error: null,
			params: {},
			rooms: [],
			fingerprint: null,
			pendingActions: 0,
			totalActions: 0,
			messageCount: 0,
			canChat: false,
		};

		for (let i in connectionDefaults) {
			if (this[i] === undefined && data[i] !== undefined) {
				this[i] = data[i];
			}
			if (this[i] === undefined) {
				this[i] = connectionDefaults[i];
			}
		}

		this.api.i18n.invokeConnectionLocale(this);
	}

	/**
	 * Generate an unique identifier for this connection.
	 *
	 * @returns {*}
	 * @private
	 */
	_generateID() {
		return randomUUID();
	}

	/**
	 * Send a message to this connection.
	 *
	 * @param message
	 */
	sendMessage(message) {
		throw new Error(`I should be replaced with a connection-specific method [${message}]`);
	}

	/**
	 * Send a file to this connection.
	 *
	 * @param path
	 */
	sendFile(path) {
		throw new Error(`I should be replaced with a connection-specific method [${path}]`);
	}

	/**
	 * Localize a message.
	 *
	 * @param message   Message to be localized.
	 */
	localize(message) {
		return this.api.i18n.localize(message, this);
	}

	destroy(callback) {
		// set connection as destroyed
		this.destroyed = true;

		// execute the destroy middleware
		this.api.connections.globalMiddleware.forEach((middlewareName) => {
			if (typeof this.api.connections.middleware[middlewareName].destroy === "function") {
				this.api.connections.middleware[middlewareName].destroy(this);
			}
		});

		// remove the connection from all rooms
		if (this.canChat === true) {
			this.rooms.forEach((room) => this.api.chatRoom.leave(this.id, room));
		}

		// get server instance
		let server = this.api.servers.servers[this.type];

		if (server) {
			if (server.attributes.logExits === true) {
				server.log("connection closed", "info", { to: this.remoteIP });
			}

			if (typeof server.goodbye === "function") {
				server.goodbye(this);
			}
		}

		// remove this connection from the connections array
		delete this.api.connections.connections[this.id];

		// execute the callback function
		if (typeof callback === "function") {
			callback();
		}
	}

	/**
	 * Set a new connection attribute.
	 *
	 * @param key
	 * @param value
	 *
	 * @return Connection The current instance.
	 */
	set(key, value) {
		this[key] = value;
		return this;
	}

	/**
	 * Execute the right operation for the given verb.
	 *
	 * @param verb      Verb to be executed.
	 * @param words     Words are optional.
	 * @param callback  Callback function.
	 */
	verbs(verb, words, callback = () => {}) {
		let key, value, room;
		let server = this.api.servers.servers[this.type];
		let allowedVerbs = server.attributes.verbs;

		if (typeof words === "function" && !callback) {
			callback = words;
			words = [];
		}

		if (!(words instanceof Array)) {
			words = [words];
		}

		if (server && allowedVerbs.indexOf(verb) >= 0) {
			// log verb message
			server.log("verb", "debug", {
				verb: verb,
				to: this.remoteIP,
				params: JSON.stringify(words),
			});

			if (verb === "quit" || verb === "exit") {
				server.goodbye(this);
			} else if (verb === "paramAdd") {
				key = words[0];
				value = words[1];

				if (words[0] && words[0].indexOf("=") >= 0) {
					let parts = words[0].split("=");
					key = parts[0];
					value = parts[1];
				}

				this.params[key] = value;

				// execute the callback function
				if (typeof callback === "function") {
					callback(null, null);
				}
			} else if (verb === "paramDelete") {
				key = words[0];
				delete this.params[key];

				// execute the callback function
				if (typeof callback === "function") {
					callback(null, null);
				}
			} else if (verb === "paramView") {
				key = words[0];

				if (typeof callback === "function") {
					callback(null, this.params[key]);
				}
			} else if (verb === "paramsView") {
				if (typeof callback === "function") {
					callback(null, this.params);
				}
			} else if (verb === "paramsDelete") {
				// delete all params
				for (let i in this.params) {
					delete this.params[i];
				}

				if (typeof callback === "function") {
					callback(null, null);
				}
			} else if (verb === "roomJoin") {
				room = words[0];

				this.api.chatRoom
					.join(this.id, room)
					.then((didHappen) => {
						callback(null, didHappen);
					})
					.catch((error) => {
						callback(error, false);
					});
			} else if (verb === "roomLeave") {
				room = words[0];
				this.api.chatRoom
					.leave(this.id, room)
					.then((didHappen) => callback(null, didHappen))
					.catch((error) => callback(error, false));
			} else if (verb === "roomView") {
				// get requested room name
				room = words[0];

				if (this.rooms.indexOf(room) > -1) {
					this.api.chatRoom
						.status(room)
						.then((status) => callback(null, status))
						.catch((error) => callback(error));
				} else {
					if (typeof callback === "function") {
						callback(`not member of room ${room}`);
					}
				}
			} else if (verb === "detailsView") {
				let details = {
					id: this.id,
					fingerprint: this.fingerprint,
					remoteIP: this.remoteIP,
					remotePort: this.remotePort,
					params: this.params,
					connectedAt: this.connectedAt,
					rooms: this.rooms,
					totalActions: this.totalActions,
					pendingActions: this.pendingActions,
				};

				// execute the callback function
				if (typeof callback === "function") {
					callback(null, details);
				}
			} else if (verb === "say") {
				// get the room name
				room = words.shift();

				// broadcast the message on the requested room
				this.api.chatRoom
					.broadcast(this, room, words.join(" "))
					.then(() => {
						callback(null);
					})
					.catch((error) => {
						callback(error);
					});
			} else if (verb === "event") {
				// get the vent information
				const { room, event, data } = words.shift();

				// execute the event on the event system
				this.api.events.fire(`event.${event}`, { room, data });
				this.api.events.fire(`event.${room}.${event}`, { room, data });

				// broadcast the event to the room
				this.api.chatRoom
					.broadcast(this, room, { event, data })
					.then(() => {
						callback(null);
					})
					.catch((error) => callback(error));
			} else {
				if (typeof callback === "function") {
					callback(this.api.config.errors.verbNotFound(this, verb), null);
				}
			}
		} else {
			if (typeof callback === "function") {
				callback(this.api.config.errors.verbNotAllowed(this, verb), null);
			}
		}
	}
}

export default class {
	/**
	 * Satellite load priority.
	 *
	 * @type {number}
	 */
	loadPriority = 400;

	/**
	 * Satellite load function.
	 *
	 * @param api   API reference object.
	 */
	async load(api) {
		api.connections = new Connections(api);
		api.connection = Connection;
	}
}
