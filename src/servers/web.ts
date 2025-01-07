import qs from "qs";
import * as path from "@std/path";
import zlib from "node:zlib";
import etag from "etag";
import Mime from "mime";
import formidable from "st-formidable";
import GenericServer from "../genericServer.js";
import BrowserFingerprint from "browser_fingerprint";
import { Buffer } from "node:buffer";

// server type
const type = "web";

// server attributes
const attributes = {
	canChat: false,
	logConnections: false,
	logExits: false,
	sendWelcomeMessage: false,
	verbs: [
		// no verbs for connections of this type, as they are to very short-lived
	],
};

/**
 * This implements the HTTP web server.
 */
export default class Web extends GenericServer {
	/**
	 * Http server instance.
	 */
	server = null;

	/**
	 * Constructor.
	 *
	 * @param api       api instance.
	 * @param options   map with the server options.
	 */
	constructor(api, options) {
		// call the super constructor
		super(api, type, options, attributes);

		this.fingerprinter = new BrowserFingerprint(this.api.config.servers.web.fingerprintOptions);

		if (["api", "file"].indexOf(this.api.config.servers.web.rootEndpointType) < 0) {
			throw new Error("api.config.servers.web.rootEndpointType can only be 'api' or 'file'.");
		}

		// -------------------------------------------------------------------------------------------------------- [EVENTS]
		this.on("connection", (connection) => {
			this.#determineRequestParams(connection, (requestMode) => {
				switch (requestMode) {
					case "api":
						this.processAction(connection);
						break;
					case "file":
						this.processFile(connection);
						break;
					case "options":
						this._respondToOptions(connection);
						break;
					case "client-lib":
						this.processClientLib(connection);
						break;
					case "trace":
						this._respondToTrace(connection);
				}
			});
		});

		// event to be executed after the action completion
		this.on("actionComplete", (data) => {
			this._completeResponse(data);
		});
	}

	// ------------------------------------------------------------------------------------------------ [REQUIRED METHODS]

	/**
	 * Start the server instance.
	 */
	async start() {
		// Use the HTTP or HTTPS server based on the provided configuration
		if (this.options.secure) {
			const https = await import("node:https");
			this.server = https.createServer(this.api.config.servers.web.serverOptions, (req, res) => {
				this.#handleRequest(req, res);
			});
		} else {
			const http = await import("node:http");
			this.server = http.createServer((req, res) => {
				this.#handleRequest(req, res);
			});
		}

		let bootAttempts = 0;

		return new Promise((resolve, reject) => {
			this.server.on("error", async (e) => {
				bootAttempts++;

				if (bootAttempts < this.api.config.servers.web.bootAttempts) {
					this.log(`cannot boot web server; trying again [${String(e)}]`, "error");

					if (bootAttempts === 1) {
						await this.#cleanSocket(this.options.bindIP, this.options.port);
					}

					setTimeout(() => {
						this.log("attempting to boot again...");
						this.server.listen(this.options.port, this.options.bindIP);
					}, 1000);
				} else {
					return reject(
						new Error(`Cannot start web server @ ${this.options.bindIP}:${this.options.port} => ${e.message}`),
					);
				}
			});

			this.server.listen(this.options.port, this.options.bindIP, () => {
				this.chmodSocket(this.options.bindIP, this.options.port);
				resolve();
			});
		});
	}

	/**
	 * Stop server.
	 */
	async stop() {
		await this.server.close();
	}

	/**
	 * Send a message to the client.
	 *
	 * @param connection  Connection object where the message must be sent.
	 * @param message     Message to be sent.
	 */
	sendMessage(connection, message) {
		// response string
		let stringResponse = "";

		// if the connection is as 'HEAD' HTTP method we need to
		// ensure the message is a string
		if (connection.rawConnection.method !== "HEAD") {
			stringResponse = String(message);
		}

		// clean HTTP headers
		this._cleanHeaders(connection);

		// get the response headers
		const headers = connection.rawConnection.responseHeaders;

		// get the response status code
		const responseHttpCode = parseInt(connection.rawConnection.responseHttpCode);

		// send the response to the client (use compression if active)
		this.sendWithCompression(connection, responseHttpCode, headers, stringResponse);
	}

	/**
	 * Send a file to the client.
	 *
	 * @param connection      Connection object where the file must be sent.
	 * @param error           Error object, null if not exists.
	 * @param fileStream      FileStream for the requested file.
	 * @param mime            File mime type.
	 * @param length          File length in bytes.
	 * @param lastModified    Timestamp if the last modification.
	 */
	async sendFile(connection, error, fileStream, mime, length, lastModified) {
		let foundCacheControl = false;
		let ifModifiedSince;
		let reqHeaders;

		// check if we should use cache mechanisms
		connection.rawConnection.responseHeaders.forEach((pair) => {
			if (pair[0].toLowerCase() === "cache-control") {
				foundCacheControl = true;
			}
		});

		// add mime type to the response headers
		connection.rawConnection.responseHeaders.push(["Content-Type", mime]);

		// If is to use a cache mechanism we must append a cache control header to the response
		if (fileStream) {
			if (!foundCacheControl) {
				connection.rawConnection.responseHeaders.push([
					"Cache-Control",
					`max-age=${this.api.config.servers.web.flatFileCacheDuration}, must-revalidate, public`,
				]);
			}
		}

		// add a header to the response with the last modified timestamp
		if (fileStream && !this.api.config.servers.web.enableEtag) {
			if (lastModified) {
				connection.rawConnection.responseHeaders.push(["Last-Modified", new Date(lastModified).toUTCString()]);
			}
		}

		// clean the connection headers
		this._cleanHeaders(connection);

		// get headers from the client request
		reqHeaders = connection.rawConnection.req.headers;

		// get the response headers
		const headers = connection.rawConnection.responseHeaders;

		// This function is used to send the response to the client.
		const sendRequestResult = () => {
			// parse the HTTP status code to int
			const responseHttpCode = parseInt(connection.rawConnection.responseHttpCode, 10);

			if (error) {
				const errorString = error instanceof Error ? String(error) : JSON.stringify(error);
				this.sendWithCompression(connection, responseHttpCode, headers, errorString);
			} else if (responseHttpCode !== 304) {
				this.sendWithCompression(connection, responseHttpCode, headers, null, fileStream, length);
			} else {
				connection.rawConnection.res.writeHead(responseHttpCode, headers);
				connection.rawConnection.res.end();
				connection.destroy();
			}
		};

		// if an error exists change the status code to 404 and send the response
		if (error) {
			connection.rawConnection.responseHttpCode = 404;
			return sendRequestResult();
		}

		// get the 'if-modified-since' value if exists
		if (reqHeaders["if-modified-since"]) {
			ifModifiedSince = new Date(reqHeaders["if-modified-since"]);
			lastModified.setMilliseconds(0);
			if (lastModified <= ifModifiedSince) {
				connection.rawConnection.responseHttpCode = 304;
			}
			return sendRequestResult();
		}

		// check if is to use ETag
		if (this.api.config.servers.web.enableEtag && fileStream && fileStream.path) {
			// Get the file states in order to create the ETag header
			try {
				const filestats = await Deno.stat(fileStream.path);

				// push the ETag header to the response
				const fileEtag = etag(filestats, { weak: true });
				connection.rawConnection.responseHeaders.push(["ETag", fileEtag]);

				let noneMatchHeader = reqHeaders["if-none-match"];
				const cacheCtrlHeader = reqHeaders["cache-control"];
				let noCache = false;
				let etagMatches;

				// check for no-cache cache request directive
				if (cacheCtrlHeader && cacheCtrlHeader.indexOf("no-cache") !== -1) {
					noCache = true;
				}

				// parse if-none-match
				if (noneMatchHeader) {
					noneMatchHeader = noneMatchHeader.split(/ *, */);
				}

				// if-none-match
				if (noneMatchHeader) {
					etagMatches = noneMatchHeader.some(
						(match) => match === "*" || match === fileEtag || match === `W/${fileEtag}`,
					);
				}

				// use the cached object
				if (etagMatches && !noCache) {
					connection.rawConnection.responseHeaders = 304;
				}

				// send response
				sendRequestResult();
			} catch (error) {
				this.log(`Error receiving file statistics`, "error", error);
				return sendRequestResult();
			}
		} else {
			sendRequestResult();
		}
	}

	/**
	 * Send a compressed message to the client.
	 *
	 * @param connection          Connection object where the message must be sent.
	 * @param responseHttpCode    HTTP Status code.
	 * @param headers             HTTP response headers.
	 * @param stringResponse      Response body.
	 * @param fileStream          FileStream, only needed if to send a file.
	 * @param fileLength          File size in bytes, only needed if is to send a file.
	 */
	sendWithCompression(connection, responseHttpCode, headers, stringResponse, fileStream, fileLength) {
		let compressor, stringEncoder;
		const acceptEncoding = connection.rawConnection.req.headers["accept-encoding"];

		// Note: this is not a conformant accept-encoding parser.
		// https://nodejs.org/api/zlib.html#zlib_zlib_createinflate_options
		// See http://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14.3
		if (this.api.config.servers.web.compress === true) {
			if (acceptEncoding.match(/\bdeflate\b/)) {
				headers.push(["Content-Encoding", "deflate"]);
				compressor = zlib.createDeflate();
				stringEncoder = zlib.deflate;
			} else if (acceptEncoding.match(/\bgzip\b/)) {
				headers.push(["Content-Encoding", "gzip"]);
				compressor = zlib.createGzip();
				stringEncoder = zlib.gzip;
			}
		}

		// the 'finish' event deontes a successful transfer
		connection.rawConnection.res.on("finish", () => {
			connection.destroy();
		});

		// the 'close' event deontes a failed transfer, but it is probably the client's fault
		connection.rawConnection.res.on("close", () => {
			connection.destroy();
		});

		if (fileStream) {
			if (compressor) {
				connection.rawConnection.res.writeHead(responseHttpCode, headers);
				fileStream.pipe(compressor).pipe(connection.rawConnection.res);
			} else {
				headers.push(["Content-Length", fileLength]);
				connection.rawConnection.res.writeHead(responseHttpCode, headers);
				fileStream.pipe(connection.rawConnection.res);
			}
		} else {
			if (stringEncoder) {
				stringEncoder(stringResponse, (_, zippedString) => {
					headers.push(["Content-Length", zippedString.length]);
					connection.rawConnection.res.writeHead(responseHttpCode, headers);
					connection.rawConnection.res.end(zippedString);
				});
			} else {
				headers.push(["Content-Length", Buffer.byteLength(stringResponse)]);
				connection.rawConnection.res.writeHead(responseHttpCode, headers);
				connection.rawConnection.res.end(stringResponse);
			}
		}
	}

	/**
	 * Disconnect a client.
	 *
	 * @param connection
	 */
	goodbye() {
		// disconnect handlers
	}

	// --------------------------------------------------------------------------------------------------------- [PRIVATE]

	/**
	 * Handle the requests.
	 *
	 * @param req   Request object.
	 * @param res   Response object.
	 * @private
	 */
	#handleRequest(req, res) {
		// get the client fingerprint
		const { fingerprint, headersHash } = this.fingerprinter.fingerprint(req);

		const responseHeaders = [];
		const cookies = this.api.utils.parseCookies(req);
		const responseHttpCode = 200;
		const method = req.method.toUpperCase();
		// TODO: check if we need something better as a default base
		const parsedURL = new URL(req.url, "http://localhost");
		let i;

		// push all cookies from the request to the response
		for (i in headersHash) {
			responseHeaders.push([i, headersHash[i]]);
		}

		// set content type to JSON
		responseHeaders.push(["Content-Type", "application/json; charset=utf-8"]);

		// push all the default headers to the response object
		for (i in this.api.config.servers.web.httpHeaders) {
			responseHeaders.push([i, this.api.config.servers.web.httpHeaders[i]]);
		}

		// get the client IP
		let remoteIP = req.connection.remoteAddress;

		// get the client port
		let remotePort = req.connection.remotePort;

		// helpers for unix socket bindings with no forward
		if (!remoteIP && !remotePort) {
			remoteIP = "0.0.0.0";
			remotePort = "0";
		}

		if (req.headers["x-forwarded-for"]) {
			let parts;
			let forwardedIp = req.headers["x-forwarded-for"].split(",")[0];
			if (forwardedIp.indexOf(".") >= 0 || (forwardedIp.indexOf(".") < 0 && forwardedIp.indexOf(":") < 0)) {
				// IPv4
				forwardedIp = forwardedIp.replace("::ffff:", ""); // remove any IPv6 information, ie: '::ffff:127.0.0.1'
				parts = forwardedIp.split(":");
				if (parts[0]) {
					remoteIP = parts[0];
				}
				if (parts[1]) {
					remotePort = parts[1];
				}
			} else {
				// IPv6
				parts = this.api.utils.parseIPv6URI(forwardedIp);
				if (parts.host) {
					remoteIP = parts.host;
				}
				if (parts.port) {
					remotePort = parts.port;
				}
			}

			if (req.headers["x-forwarded-port"]) {
				remotePort = req.headers["x-forwarded-port"];
			}
		}

		this.buildConnection({
			// will emit 'connection'
			rawConnection: {
				req: req,
				res: res,
				params: {},
				method: method,
				cookies: cookies,
				responseHeaders: responseHeaders,
				responseHttpCode: responseHttpCode,
				parsedURL: parsedURL,
			},
			id: `${fingerprint}-${crypto.randomUUID()}`,
			fingerprint: fingerprint,
			remoteAddress: remoteIP,
			remotePort: remotePort,
		});
	}

	/**
	 * Change socket permission.
	 *
	 * @param bindIP  IP here socket is listening.
	 * @param port    Port that socket is listening.
	 */
	chmodSocket(bindIP, port) {
		if (!bindIP && port.indexOf("/") >= 0) {
			Deno.chmodSync(port, 0o777);
		}
	}

	/**
	 * Determine the request params.
	 *
	 * @param connection  Client connection object.
	 * @param callback    Callback function.
	 * @private
	 */
	#determineRequestParams(connection, callback) {
		const url: URL = connection.rawConnection.parsedURL;
		const pathname = url.pathname;

		// determine if is a file or an api request
		let requestMode = this.api.config.servers.web.rootEndpointType;
		const pathParts = pathname.split("/");
		let matcherLength, i;

		// remove empty parts from the beginning of the path
		while (pathParts[0] === "") {
			pathParts.shift();
		}

		// if exist an empty part on the end of the path, remove it
		if (pathParts[pathParts.length - 1] === "") {
			pathParts.pop();
		}

		if (pathParts[0] && pathParts[0] === this.api.config.servers.web.urlPathForActions) {
			requestMode = "api";
			pathParts.shift();
		} else if (pathParts[0] && pathParts[0] === this.api.config.servers.websocket.clientJsName) {
			requestMode = "client-lib";
			pathParts.shift();
		} else if (pathParts[0] && pathParts[0] === this.api.config.servers.web.urlPathForFiles) {
			requestMode = "file";
			pathParts.shift();
		} else if (pathParts[0] && pathname.indexOf(this.api.config.servers.web.urlPathForActions) === 0) {
			requestMode = "api";
			matcherLength = this.api.config.servers.web.urlPathForActions.split("/").length;
			for (i = 0; i < matcherLength - 1; i++) {
				pathParts.shift();
			}
		} else if (pathParts[0] && pathname.indexOf(this.api.config.servers.web.urlPathForFiles) === 0) {
			requestMode = "file";
			matcherLength = this.api.config.servers.web.urlPathForFiles.split("/").length;
			for (i = 0; i < matcherLength - 1; i++) {
				pathParts.shift();
			}
		}

		// split parsed URL by '.'
		const extensionParts = connection.rawConnection.parsedURL.pathname.split(".");

		if (extensionParts.length > 1) {
			connection.extension = extensionParts[extensionParts.length - 1];
		}

		// OPTIONS
		if (connection.rawConnection.method === "OPTIONS") {
			requestMode = "options";
			callback(requestMode);
		} else if (requestMode === "api") {
			// API
			// enable trace mode
			if (connection.rawConnection.method === "TRACE") {
				requestMode = "trace";
			}

			const searchString = url.search.slice(1);
			const queryStringParameters = qs.parse(searchString, this.api.config.servers.web.queryParseOptions);
			this.#fillParamsFromWebRequest(connection, queryStringParameters);

			// copy the raw search params into the connection
			connection.rawConnection.params.query = Object.fromEntries(url.searchParams);

			if (
				connection.rawConnection.method !== "GET" &&
				connection.rawConnection.method !== "HEAD" &&
				(connection.rawConnection.req.headers["content-type"] || connection.rawConnection.req.headers["Content-Type"])
			) {
				connection.rawConnection.form = new formidable.IncomingForm();

				for (i in this.api.config.servers.web.formOptions) {
					connection.rawConnection.form[i] = this.api.config.servers.web.formOptions[i];
				}

				connection.rawConnection.form.parse(connection.rawConnection.req, (error, fields, files) => {
					if (error) {
						this.log(`error processing form: ${String(error)}`, "error");
						connection.error = new Error("There was an error processing this form.");
					} else {
						connection.rawConnection.params.body = fields;
						connection.rawConnection.params.files = files;
						this.#fillParamsFromWebRequest(connection, files);
						this.#fillParamsFromWebRequest(connection, fields);
					}

					if (this.api.config.servers.web.queryRouting !== true) {
						connection.params.action = null;
					}

					// process route
					this.api.routes.processRoute(connection, pathParts);

					callback(requestMode);
				});
			} else {
				if (this.api.config.servers.web.queryRouting !== true) {
					connection.params.action = null;
				}

				// process route
				this.api.routes.processRoute(connection, pathParts);

				callback(requestMode);
			}
		} else if (requestMode === "file") {
			if (!connection.params.file) {
				connection.params.file = pathParts.join(path.SEPARATOR);
			}

			if (connection.params.file === "" || connection.params.file[connection.params.file.length - 1] === "/") {
				connection.params.file = connection.params.file + this.api.config.general.directoryFileType;
			}
			callback(requestMode);
		} else if (requestMode === "client-lib") {
			callback(requestMode);
		}
	}

	processClientLib(connection) {
		// client lib
		const file = path.normalize(
			`${this.api.config.general.paths.public + path.SEPARATOR + this.api.config.servers.websocket.clientJsName}.js`,
		);

		// define the file to be loaded
		connection.params.file = file;

		// process like a file
		this.processFile(connection);
	}

	/**
	 * Fill the connection with the web request params.
	 *
	 * @param connection  Connection object.
	 * @param varsHash    Request params.
	 * @private
	 */
	#fillParamsFromWebRequest(connection, varsHash) {
		// helper for JSON parts
		const collapsedVarsHash = this.api.utils.collapseObjectToArray(varsHash);

		if (collapsedVarsHash !== false) {
			// post was an array, lets call it "payload"
			varsHash = { payload: collapsedVarsHash };
		}

		// copy requests params to connection object
		for (const v in varsHash) {
			connection.params[v] = varsHash[v];
		}
	}

	/**
	 * Complete the response.
	 *
	 * THis add additional server info to the response message, and
	 * build the final response object.
	 *
	 * @param data  Data to be sent to the client.
	 * @private
	 */
	_completeResponse(data) {
		if (data.toRender !== true) {
			if (data.connection.rawConnection.res.finished) {
				data.connection.destroy();
			} else {
				data.connection.rawConnection.res.on("finish", () => data.connection.destroy());
				data.connection.rawConnection.res.on("close", () => data.connection.destroy());
			}

			return;
		}

		if (this.api.config.servers.web.metadataOptions.serverInformation) {
			const stopTime = new Date().getTime();

			data.response.serverInformation = {
				serverName: this.api.config.general.serverName,
				apiVersion: this.api.config.general.apiVersion,
				requestDuration: stopTime - data.connection.connectedAt,
				currentTime: stopTime,
			};
		}

		// check if is to use requester information
		if (this.api.config.servers.web.metadataOptions.requesterInformation) {
			data.response.requesterInformation = this._buildRequesterInformation(data.connection);
		}

		// is an error response?
		if (data.response.error) {
			if (
				this.api.config.servers.web.returnErrorCodes === true &&
				data.connection.rawConnection.responseHttpCode === 200
			) {
				if (data.actionStatus === "unknown_action") {
					data.connection.rawConnection.responseHttpCode = 404;
				} else if (data.actionStatus === "missing_params") {
					data.connection.rawConnection.responseHttpCode = 422;
				} else if (data.actionStatus === "server_error") {
					data.connection.rawConnection.responseHttpCode = 500;
				} else {
					data.connection.rawConnection.responseHttpCode = 400;
				}
			}
		}

		if (
			!data.response.error &&
			data.action &&
			data.params.apiVersion &&
			this.api.actions.actions[data.params.action][data.params.apiVersion].matchExtensionMimeType === true &&
			data.connection.extension
		) {
			data.connection.rawConnection.responseHeaders.push(["Content-Type", Mime.getType(data.connection.extension)]);
		}

		// if its an error response we need to serialize the error object
		if (data.response.error) {
			data.response.error = this.api.config.errors.serializers.servers.web(data.response.error);
		}

		let stringResponse = "";

		// build the string response
		if (this._extractHeader(data.connection, "Content-Type").match(/json/)) {
			try {
				stringResponse = JSON.stringify(data.response, null, this.api.config.servers.web.padding);
			} catch (_) {
				data.connection.rawConnection.responseHttpCode = 500;
				stringResponse = JSON.stringify({
					error: "invalid_response_object",
					requesterInformation: this._buildRequesterInformation(data.connection),
				});
			}

			if (data.params.callback) {
				data.connection.rawConnection.responseHeaders.push(["Content-Type", "application/javascript"]);
				stringResponse = `${data.connection.params.callback}(${stringResponse});`;
			}
		} else {
			stringResponse = data.response;
		}

		// return the response to the client
		this.sendMessage(data.connection, stringResponse);
	}

	/**
	 * Extract one header from a connection object.
	 *
	 * @param connection  Connection object from the header must be extracted.
	 * @param match       Header name.
	 * @returns {*}       Null if not found, otherwise the header value.
	 * @private
	 */
	_extractHeader(connection, match) {
		let i = connection.rawConnection.responseHeaders.length - 1;

		while (i >= 0) {
			if (connection.rawConnection.responseHeaders[i][0].toLowerCase() === match.toLowerCase()) {
				return connection.rawConnection.responseHeaders[i][1];
			}
			i--;
		}

		return null;
	}

	/**
	 * Build the requester information.
	 *
	 * @param connection
	 * @returns {{id: number, fingerprint: (*|BrowserFingerprint.fingerprint|null), remoteIP: string, receivedParams: {}}}
	 * @private
	 */
	_buildRequesterInformation(connection) {
		// build the request information object
		const requesterInformation = {
			id: connection.id,
			fingerprint: connection.fingerprint,
			remoteIP: connection.remoteIP,
			receivedParams: {},
		};

		// copy all the connection params to the request information
		for (const param in connection.params) {
			requesterInformation.receivedParams[param] = connection.params[param];
		}

		// return the request information
		return requesterInformation;
	}

	/**
	 * Remove some unnecessary headers from the response.
	 *
	 * @param connection  Client connection object.
	 * @private
	 */
	_cleanHeaders(connection) {
		// make a copy of the original headers
		const originalHeaders = connection.rawConnection.responseHeaders.reverse();
		const foundHeaders = [];
		const cleanedHeaders = [];

		// iterate all headers and remove duplications and unnecessary headers
		for (const i in originalHeaders) {
			// get header name and value
			const key = originalHeaders[i][0];
			const value = originalHeaders[i][1];

			if (foundHeaders.indexOf(key.toLowerCase()) >= 0 && key.toLowerCase().indexOf("set-cookie") < 0) {
				// ignore, it's a duplicate
			} else if (connection.rawConnection.method === "HEAD" && key === "Transfer-Encoding") {
				// ignore, we can't send this header for HEAD requests
			} else {
				foundHeaders.push(key.toLowerCase());
				cleanedHeaders.push([key, value]);
			}
		}

		// set the clean headers on the connection
		connection.rawConnection.responseHeaders = cleanedHeaders;
	}

	/**
	 * Respond to an option request.
	 *
	 * @param connection  Connection object.
	 * @private
	 */
	_respondToOptions(connection = null) {
		// inform the allowed methods
		if (
			!this.api.config.servers.web.httpHeaders["Access-Control-Allow-Methods"] &&
			!this._extractHeader(connection, "Access-Control-Allow-Methods")
		) {
			const methods = "HEAD, GET, POST, PUT, DELETE, OPTIONS, TRACE";
			connection.rawConnection.responseHeaders.push(["Access-Control-Allow-Methods", methods]);
		}

		// inform the allowed origins
		if (
			!this.api.config.servers.web.httpHeaders["Access-Control-Allow-Origin"] &&
			!this._extractHeader(connection, "Access-Control-Allow-Origin")
		) {
			const origin = "*";
			connection.rawConnection.responseHeaders.push(["Access-Control-Allow-Origin", origin]);
		}

		// send the message to client
		this.sendMessage(connection, "");
	}

	/**
	 * Respond to a trace request.
	 *
	 * @param connection  Client connection object.
	 * @private
	 */
	_respondToTrace(connection) {
		// build the request information
		const data = this._buildRequesterInformation(connection);

		// build the response string and send it to the client
		const stringResponse = JSON.stringify(data, null, this.api.config.servers.web.padding);
		this.sendMessage(connection, stringResponse);
	}

	/**
	 * Try remove the stale unix socket.
	 *
	 * @param bindIP
	 * @param port
	 * @private
	 */
	async #cleanSocket(bindIP, port) {
		if (!bindIP && port.indexOf("/") >= 0) {
			try {
				await Deno.remove(port);
				this.log(`removed stale unix socket @${port}`);
			} catch (error) {
				this.log(`cannot remove stale socket @${port}`, "error", error);
			}
		}
	}
}
