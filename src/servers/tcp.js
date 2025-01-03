import net from "node:net";
import tls from "node:tls";
import GenericServer from "../genericServer.js";
import { sleep } from "../utils.ts";

// server type
const type = "tcp";

// server attributes
let attributes = {
	canChat: true,
	logConnections: true,
	logExits: true,
	pendingShutdownWaitLimit: 5000,
	sendWelcomeMessage: true,
	verbs: [
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
	],
};

/**
 * TCP server implementation.
 */
export default class Tcp extends GenericServer {
	/**
	 * TCP server socket.
	 */
	server = null;

	/**
	 * Create a new server instance.
	 *
	 * @param api       API object reference.
	 * @param options   Server options.
	 */
	constructor(api, options) {
		// call super constructor
		super(api, type, options, attributes);

		// define events
		this._defineEvents();
	}

	// ------------------------------------------------------------------------------------------------ [Required Methods]

	/**
	 * Start server.
	 */
	async start() {
		return new Promise((resolve, reject) => {
			if (this.options.secure === false) {
				this.server = net.createServer(this.api.config.servers.tcp.serverOptions, (rawConnection) => {
					this._handleConnection(rawConnection);
				});
			} else {
				this.server = tls.createServer(this.api.config.servers.tcp.serverOptions, (rawConnection) => {
					this._handleConnection(rawConnection);
				});
			}

			// on server error
			this.server.on("error", (e) => {
				return reject(
					new Error(`Cannot start tcp server @ ${this.options.bindIP}:${this.options.port} => ${e.message}`),
				);
			});

			// server listener
			this.server.listen(this.options.port, this.options.bindIP, () => {
				resolve();
			});
		});
	}

	/**
	 * Stop server.
	 */
	async stop() {
		await this._gracefulShutdown();
	}

	/**
	 * Send a message to a client.
	 *
	 * @param connection    Client connection object.
	 * @param message       Message to be sent.
	 * @param messageCount  Number of messages already sent for this client.
	 */
	sendMessage(connection, message, messageCount) {
		// if is an error message serialize the object
		if (message.error) {
			message.error = this.api.config.errors.serializers.servers.tcp(message.error);
		}

		if (connection.respondingTo) {
			message.messageCount = messageCount;
			connection.respondingTo = null;
		} else if (message.context === "response") {
			// if the messageCount isn't defined use the connection.messageCount
			if (messageCount) {
				message.messageCount = messageCount;
			} else {
				message.messageCount = connection.messageCount;
			}
		}

		// try send the message to the client
		try {
			connection.rawConnection.write(`${JSON.stringify(message)}\r\n`);
		} catch (e) {
			this.api.log(`socket write error: ${e}`, "error");
		}
	}

	/**
	 * Close the connection with the client sending a 'Bye!' message.
	 *
	 * @param connection  Client connection.
	 */
	goodbye(connection) {
		try {
			connection.rawConnection.end(
				`${JSON.stringify({
					status: connection.localize(this.api.config.servers.tcp.goodbeyMessage),
					context: "api",
				})}\r\n`,
			);
		} catch (e) {
			// ignore error
		}
	}

	/**
	 * Send a file to the client.
	 *
	 * If the error is defined send a error message instead.
	 *
	 * @param connection  Client connection object.
	 * @param error       Error object.
	 * @param fileStream  FileStream object.
	 */
	sendFile(connection, error, fileStream) {
		// if is an error response send a message with the error
		if (error) {
			this.server.sendMessage(connection, error, connection.messageCount);
		} else {
			// send the file to client
			fileStream.pipe(connection.rawConnection, { end: false });
		}
	}

	// ---------------------------------------------------------------------------------------------------------- [Events]

	/**
	 * Define server events.
	 *
	 * @private
	 */
	_defineEvents() {
		// on connection event
		this.on("connection", (connection) => {
			connection.params = {};

			let parseLine = (line) => {
				// check the message length if the maxDataLength is active
				if (this.api.config.servers.tcp.maxDataLength > 0) {
					let bufferLen = Buffer.byteLength(line, "utf8");

					if (bufferLen > this.api.config.servers.tcp.maxDataLength) {
						let error = this.api.config.errors.dataLengthTooLarge(this.api.config.servers.tcp.maxDataLength, bufferLen);
						this.log(error, "error");
						return this.sendMessage(connection, {
							status: "error",
							error: error,
							context: "response",
						});
					}
				}

				if (line.length > 0) {
					// increment at the start of the request so that responses can be caught in order
					// on the client, this is not handled by the genericServer
					connection.messageCount++;
					this._parseRequest(connection, line);
				}
			};

			// on data event
			connection.rawConnection.on("data", (chunk) => {
				if (this._checkBreakChars(chunk)) {
					connection.destroy();
				} else {
					connection.rawConnection.socketDataString += chunk.toString("utf-8").replace(/\r/g, "\n");
					let index;

					// get delimiter
					let delimiter = String(this.api.config.servers.tcp.delimiter);

					while ((index = connection.rawConnection.socketDataString.indexOf(delimiter)) > -1) {
						let data = connection.rawConnection.socketDataString.slice(0, index);
						connection.rawConnection.socketDataString = connection.rawConnection.socketDataString.slice(
							index + delimiter.length,
						);
						data.split(delimiter).forEach(parseLine);
					}
				}
			});

			// on end event
			connection.rawConnection.on("end", () => {
				// if the connection isn't destroyed do it now
				if (connection.destroyed !== true) {
					try {
						connection.rawConnection.end();
					} catch (e) {
						// ignore error
					}
					connection.destroy();
				}
			});

			// on error event
			connection.rawConnection.on("error", (e) => {
				if (connection.destroyed !== true) {
					this.log(`server error: ${e}`, "error");

					try {
						connection.rawConnection.end();
					} catch (e) {
						// ignore error
					}
					connection.destroy();
				}
			});
		});

		// on actionComplete event
		this.on("actionComplete", (data) => {
			if (data.toRender === true) {
				data.response.context = "response";
				this.sendMessage(data.connection, data.response, data.messageCount);
			}
		});
	}

	// --------------------------------------------------------------------------------------------------------- [Helpers]

	/**
	 * Parse client request.
	 *
	 * @param connection  Client connection object.
	 * @param line        Request line to be parsed.
	 * @private
	 */
	_parseRequest(connection, line) {
		let words = line.split(" ");

		// get the verb how are
		let verb = words.shift();

		if (verb === "file") {
			if (words.length > 0) {
				connection.params.file = words[0];
			}
			this.processFile(connection);
			return;
		}

		connection.verbs(verb, words, (error, data) => {
			// send an success response message, when there is no errors
			if (!error) {
				this.sendMessage(connection, {
					status: "OK",
					context: "response",
					data: data,
				});
				return;
			}

			if (error.code && error.code.match("014")) {
				// Error: Verb not found or not allowed
				// check for and attempt to check single-use params
				try {
					// parse JSON request
					let requestHash = JSON.parse(line);

					// pass all founded params to the connection object
					if (requestHash.params !== undefined) {
						connection.params = {};

						for (let v in requestHash.params) {
							connection.params[v] = requestHash.params[v];
						}
					}

					// pass action name to the connection object, if exists
					if (requestHash.action) {
						connection.params.action = requestHash.action;
					}
				} catch (e) {
					connection.params.action = verb;
				}

				// reset some connection properties
				connection.error = null;
				connection.response = {};

				// process actions
				this.processAction(connection);
				return;
			}

			// send an error message
			this.sendMessage(connection, {
				status: error,
				context: "response",
				data: data,
			});
		});
	}

	/**
	 * Handle new connection.
	 *
	 * @param rawConnection Client raw connection object.
	 * @private
	 */
	_handleConnection(rawConnection) {
		// if the options are enabled, set keepAlive to true
		if (this.api.config.servers.tcp.setKeepAlive === true) {
			rawConnection.setKeepAlive(true);
		}

		// reset socket data
		rawConnection.socketDataString = "";

		// build a new connection object (will emit 'connection')
		this.buildConnection({
			rawConnection: rawConnection,
			remoteAddress: rawConnection.remoteAddress,
			remotePort: rawConnection.remotePort,
		});
	}

	/**
	 * Check if the chunk contains the break chars.
	 *
	 * @param chunk         Chunk to the analysed.
	 * @returns {boolean}   True if found, false otherwise.
	 * @private
	 */
	_checkBreakChars(chunk) {
		let found = false;
		let hexChunk = chunk.toString("hex", 0, chunk.length);

		if (hexChunk === "fff4fffd06") {
			found = true; // CTRL + C
		} else if (hexChunk === "04") {
			found = true; // CTRL + D
		}

		return found;
	}

	/**
	 * Try a graceful shutdown.
	 *
	 * We will wait a while to Stellar try response to the pending connections.
	 *
	 * @param alreadyShutdown   Informs if the server was already shutdown.
	 * @private
	 */
	async _gracefulShutdown(alreadyShutdown = false) {
		// if the server isn't already shutdown do it now
		if (!alreadyShutdown || alreadyShutdown === false) {
			this.server.close();
		}

		let pendingConnections = 0;

		// finish all pending connections
		this.connections().forEach((connection) => {
			// if there is no pending actions destroy the connection
			if (connection.pendingActions === 0) {
				connection.destroy();
				return;
			}

			// increment the pending connections
			pendingConnections++;

			if (!connection.rawConnection.shutDownTimer) {
				connection.rawConnection.shutDownTimer = setTimeout(() => {
					connection.destroy();
				}, attributes.pendingShutdownWaitLimit);
			}
		});

		return new Promise(async (resolve) => {
			if (pendingConnections > 0) {
				this.log(
					`waiting on shutdown, there are still ${pendingConnections} connected clients waiting on a response`,
					"notice",
				);

				await sleep(1000);
				this._gracefulShutdown(true);
			} else {
				resolve();
			}
		});
	}
}
