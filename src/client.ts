/* eslint-disable */
// @ts-nocheck
declare const Headers: unknown;
declare const Request: unknown;
declare function fetch(request: any): Promise<any>;

import type Primus from "primus";

type HandlerFn = (...args: unknown[]) => void;
type Interceptor = (params: unknown, next: CallableFunction) => void;

interface ConnectionDetailsInterface {
	/**
	 * Type of connection.
	 */
	connectedAt: Date;
	rooms: Array<string>;
	totalActions: number;

	// TODO: expand the connection details
	[key: string]: unknown;
}

interface ConnectionDetailsResponse {
	data: ConnectionDetailsInterface;
}

/**
 * Possible states for the client.
 */
enum ClientState {
	Disconnect = "disconnected",
	Connected = "connected",
	Reconnecting = "reconnecting",
	Timeout = "timeout",
}

type ClientOptions = {
	rooms: string[];
	url: string;
	apiPath: string;
	defaultRoom: string;
};

const warn = (msg: string) => console.warn(`[Stellar warn]: ${msg}`);
const error = (msg: string) => console.error(`[Stellar error]: ${msg}`);
const isFunction = (val: unknown): val is CallableFunction => typeof val === "function";
const isObject = (obj: unknown) => obj !== null && typeof obj === "object";

// ----------------------------------------------------------------------------- [Build Event]

class BuildEvent {
	/**
	 * Client instance.
	 */
	private client: StellarClient;

	/**
	 * Selected rooms.
	 */
	private rooms: Array<string>;

	constructor(room: string | string[], client: StellarClient) {
		this.client = client;

		if (Array.isArray(room)) {
			this.rooms = room;
		} else {
			this.rooms = [room];
		}
	}

	/**
	 * Internal method to add room.
	 *
	 * @param room        Room to add.
	 */
	private innerRoomAdd(room: string | string[]) {
		if (Array.isArray(room)) {
			this.rooms = this.rooms.concat(room);
		} else {
			this.rooms.push(room);
		}

		return this;
	}

	/**
	 * Add a new room where the event must be sent.
	 *
	 * @param room New room to append, or an array.
	 */
	to(room: string) {
		return this.innerRoomAdd(room);
	}

	/**
	 * Send the event to the server.
	 *
	 * We send an event for each room.
	 *
	 * @param event   Event name.
	 * @param data    data to send with the event.
	 */
	emit(event: string, data: unknown) {
		const work: Array<Promise<unknown>> = [];

		// send an event for each room, and store the Promise on the array
		this.rooms.forEach((room) => {
			work.push(this.client.send({ event: "event", params: { room, event, data } }));
		});

		return Promise.all(work);
	}

	/**
	 * Add a new room, to filter the event handler.
	 *
	 * @param room        Room to filter.
	 */
	from(room: string) {
		return this.innerRoomAdd(room);
	}

	/**
	 * Handle an event reception.
	 *
	 * @param event     Event name.
	 * @param handler  Event handler.
	 */
	on(event: string, handler: () => void): BuildEvent {
		this.rooms.forEach((room) => {
			this.client.on(`[${room}].${event}`, handler);
		});

		return this;
	}

	off(event: string, handler: () => void) {
		this.rooms.forEach((room) => {
			this.client.removeListener(`[${room}].${event}`, handler);
		});

		return this;
	}
}

let BaseClass;
if (typeof Primus === "undefined") {
	BaseClass = require("events").EventEmitter;
} else {
	BaseClass = Primus.EventEmitter;
}

class StellarClient extends BaseClass {
	/**
	 * Client identifier.
	 */
	public id!: string;

	/**
	 * Client state.
	 */
	private state: ClientState = ClientState.Disconnect;

	/**
	 * Dictionary with all existing events.
	 */
	private events = {};

	/**
	 * Array of available rooms.
	 */
	private rooms: Array<string> = [];

	/**
	 * Number of sent messages.
	 */
	private messageCount = 0;

	/**
	 * Client options.
	 */
	private options: ClientOptions = { rooms: [], url: "", apiPath: "", defaultRoom: "" };

	/**
	 * Informs if is to use an external client.
	 */
	private useExternalClient = false;

	/**
	 * External client.
	 */
	private client;

	/**
	 * Dictionary of callbacks.
	 */
	private callbacks: CallableFunction[] = [];

	/**
	 * Client fingerprint.
	 *
	 * This is used to identify the client.
	 */
	private fingerprint!: string;

	/**
	 * Pending requests queue.
	 */
	private pendingRequestsQueue: Array<CallableFunction> = [];

	/**
	 * Array of interceptors.
	 *
	 * This is used to process before and after an action call.
	 */
	private interceptors: Array<Interceptor> = [];

	/**
	 * Number of pending requests.
	 */
	private pendingRequestsCounter = 0;

	protected welcomeMessage!: string;

	/**
	 * This is for internal use only.
	 *
	 * Original Primus emit event.
	 */
	private _emit;
	/**
	 * Create a new Stellar client instance.
	 *
	 * @param options Option to be passed to the new Stellar client instance.
	 * @param client Optional client that can be given to be used as a connection with the server.
	 */
	constructor(options: any, client: any = null) {
		super();

		// Save the original emit method to use as local event emitter.
		(this as any)._emit = super.emit;

		// Fill options with the default ones and after it
		// merge with the ones passed by parameter to allow
		// overwrite the default.
		this.options = {
			...this.defaults(),
			...options,
		};

		if (client) {
			this.client = client;
			this.useExternalClient = true;
		}

		// Print out an error when Promises aren't supported
		if (Promise === undefined || typeof Promise !== "function") {
			error("Th browser doesn't support Promises! You must load a polyfill before load Stellar client lib.");
		}
	}

	/**
	 * Default options.
	 */
	private defaults(): any {
		return "%%DEFAULTS%%";
	}

	private setEventHandler(): Promise<ConnectionDetailsInterface> {
		const promise = new Promise((resolve, reject) => {
			this.client.on("open", async () => {
				const details = await this.configure();

				if (this.state !== ClientState.Connected) {
					this.state = ClientState.Connected;
					resolve(details);
				}

				this._emit("connected");
			});

			this.client.on("error", (err) => {
				reject(err);
				this._emit("error", err);
			});
		});

		this.client.on("reconnect", () => {
			this.messageCount = 0;
			this._emit("reconnect");
		});

		this.client.on("reconnecting", () => {
			this._emit("reconnecting");
			this.state = ClientState.Reconnecting;
			this._emit("disconnected");
		});

		this.client.on("timeout", () => {
			this.state = ClientState.Timeout;
			this._emit("timeout");
		});

		this.client.on("data", this._handleMessage.bind(this));

		return promise as Promise<ConnectionDetailsInterface>;
	}

	public connect(): Promise<ConnectionDetailsInterface> {
		this.messageCount = 0;

		if (this.client && !this.useExternalClient) {
			this.client.end();
			this.client.removeAllListeners();
			// TODO: seems that the connect method is no longer available on Primus
			// @ts-ignore
			this.client = Primus.connect(this.options.url, this.options);
		} else if (this.client && this.useExternalClient) {
			this.client.end();
			this.client.open();
		} else {
			// @ts-ignore
			this.client = Primus.connect(this.options.url, this.options);
		}

		return this.setEventHandler();
	}

	/**
	 * Send a message.
	 *
	 * @param data Data to be sent.
	 */
	public send(data: any): Promise<any> {
		return new Promise((resolve) => {
			this.messageCount += 1;
			this.callbacks[this.messageCount] = resolve;
			this.client.write(data);
		});
	}

	private _handleMessage(message: any): void {
		this._emit("message", message);

		if (message.context === "response") {
			if (typeof this.callbacks[message.messageCount] === "function") {
				this.callbacks[message.messageCount](message);
			}

			delete this.callbacks[message.messageCount];
		} else if (message.context === "user") {
			this._emit("say", message);

			if (message.message.event) {
				const packet = message.message;

				// emit event into global scope
				this._emit(packet.event, packet.data, message);

				// emit an event specific for the given room
				this._emit(`[${message.room}].${packet.event}`, packet.data, message);
			}
		} else if (message.context === "alert") {
			this._emit("alert", message);
		} else if (message.welcome && message.context === "api") {
			this.welcomeMessage = message.welcome;
			this._emit("welcome", message);
		} else if (message.context === "api") {
			this._emit("api", message);
		}
	}

	public async configure(): Promise<ConnectionDetailsInterface> {
		if (this.options.rooms) {
			this.options.rooms.forEach((room) => this.send({ event: "roomAdd", room }));
		}

		const details = await this.detailsView();

		// Save connection information
		this.id = details.data.id;
		// TODO: do this prop is always a string? I din't know for sure.
		this.fingerprint = details.data.fingerprint as string;
		this.rooms = details.data.rooms;

		return details.data;
	}

	/**
	 * Send an event to the server.
	 *
	 * @param event Event name.
	 * @param data Data to send with the event. This can be optional.
	 */
	// @ts-ignore
	public emit(event: string, data: any = null): Promise<void> {
		const room = this.options.defaultRoom;
		return this.send({ event: "event", params: { event, room, data } });
	}

	/**
	 * Request the details view.
	 */
	public detailsView(): Promise<ConnectionDetailsResponse> {
		return this.send({
			event: "detailsView",
		}) as Promise<ConnectionDetailsResponse>;
	}

	/**
	 * Process the next pending request if available.
	 */
	public processNextPendingRequest(): void {
		if (this.pendingRequestsQueue.length === 0) {
			return;
		}

		const requestFn = this.pendingRequestsQueue.shift();
		requestFn!();
	}

	/**
	 * Send an event to a specific room.
	 *
	 * @param room Room name.
	 */
	public to(room: string): BuildEvent {
		return new BuildEvent(room, this);
	}

	/**
	 * Receive an event to a specific room.
	 *
	 * @param room Room name.
	 */
	public from(room: string): BuildEvent {
		return new BuildEvent(room, this);
	}

	/**
	 * Remove a listener for a given event.
	 *
	 * @param event Event name.
	 * @param handler Listener to be removed.
	 */
	public off(event: string, handler: HandlerFn) {
		return this.removeListener(event, handler);
	}

	/**
	 * Send a message to a room.
	 *
	 * @param room Room name.
	 * @param message Message to be sent.
	 */
	public say(room: string, message: any): Promise<any[]> {
		if (message === undefined) {
			message = room;
			room = this.options.defaultRoom;
		}

		return this.to(room).emit("message", message);
	}

	/**
	 * Make a file request.
	 *
	 * @param file File to be requested.
	 */
	public file(file: string): Promise<any> {
		return this.send({ event: "file", file });
	}

	/**
	 * Request a room state.
	 *
	 * @param room Room name.
	 */
	public roomView(room: string) {
		return this.send({ event: "roomView", room });
	}

	/**
	 * Join to a room.
	 *
	 * @param room Room name.
	 */
	public async join(room: string): Promise<ConnectionDetailsInterface> {
		await this.send({ event: "roomJoin", room });
		return this.configure();
	}

	/**
	 * Leave a room.
	 *
	 * @param room Name of the room to be left.
	 */
	public async leave(room: string) {
		const index = this.rooms.indexOf(room);

		if (index > -1) {
			this.rooms.splice(index, 1);
		}

		await this.send({ event: "roomLeave", room });

		return this.configure();
	}

	/**
	 * Disconnect the client from the server.
	 */
	public disconnect() {
		this.state = ClientState.Disconnect;
		this.client.end();
		this._emit("disconnected");
	}

	/**
	 * Call an action using a normal HTTP connection though Fetch API.
	 */
	private async _actionWeb(params: any): Promise<any> {
		const method = ((params.httpMethod || "POST") as string).toUpperCase();
		let url = `${this.options.url}${(this, this.options.apiPath)}?action=${params.action}`;

		// When it's a GET request we must append the params to the URL address
		if (method === "GET") {
			for (const param in params) {
				if (["action", "httpMethod"].includes(param)) {
					continue;
				}
				url += `&${param}=${params[param]}`;
			}
		}

		const options: any = {
			method,
			mode: "cors",
			headers: new Headers({
				"Content-Type": "application/json",
			}),
		};

		if (method === "POST") {
			options.body = JSON.stringify(params);
		}

		const request = new Request(url, options);
		const response = await fetch(request);
		const responseInJson = response.json();
		if (response.status !== 200) {
			throw await responseInJson;
		}

		return responseInJson;
	}

	/**
	 * Send an action call request by WebSocket.
	 *
	 * @param params Call parameters.
	 */
	private async _actionWebSocket(params: any): Promise<any> {
		const response = await this.send({ event: "action", params });

		if (response.error !== undefined) {
			throw response;
		}

		return response;
	}

	/**
	 * Call an action.
	 *
	 * If this client instance are connected though a WebSocket we use that connection to made the request, otherwise use
	 * a normal HTTP request, using the Fetch API. This makes possible call actions as soon as the lib is loaded.
	 *
	 * @param action Name of the action to be called.
	 * @param params Action parameters.
	 */
	public action(action: string, params: any = {}): Promise<any> {
		return new Promise((resolve, reject) => {
			// contains the reference for the current handler
			let handler;

			// array with the request interceptor. We need to make a copy to keep the
			// original array intact
			const reqHandlers = this.interceptors.slice(0);

			// array with the response handlers. this is local to avoid repetition
			const resHandlers: Array<any> = [];

			// sets the parameter action, in case of the action call be done over HTTP.
			params.action = action;

			const next = (response: any = null, error?: Error) => {
				if (error !== undefined && error !== null) {
					resHandlers.forEach((h) => h.call(this, error));
					return reject(error);
				}

				if (isFunction(response)) {
					resHandlers.unshift(response);
				} else if (isObject(response)) {
					resHandlers.forEach((h) => h.call(this, response));
					return resolve(response);
				}

				exec();
			};

			const exec = () => {
				// if there is no more request handlers to process we must perform the request
				if (reqHandlers.length === 0) {
					let method;

					// If the client is connected the call should be done by WebSocket otherwise we use HTTP
					if (this.state !== ClientState.Connected) {
						method = this._actionWeb;
					} else {
						method = this._actionWebSocket;
					}

					this.pendingRequestsCounter += 1;

					const processRequest = async () => {
						try {
							const response = await method.call(this, params);
							next(response);
						} catch (error) {
							next(null, error);
						}

						this.pendingRequestsCounter -= 1;
						this.processNextPendingRequest();
					};

					// if the number of pending request is bigger than the server limit, the request must be placed on the a queue
					// to be processed later.
					if (this.pendingRequestsCounter >= this.options.simultaneousActions) {
						this.pendingRequestsQueue.push(processRequest);
						return;
					}

					return processRequest();
				}

				handler = reqHandlers.pop();
				if (handler && isFunction(handler)) {
					handler.call(this, params, next, reject);
				} else {
					warn(`Invalid interceptor of type ${typeof handler}, must be a function`);
					next();
				}

				return;
			};

			// Start processing the interceptors
			exec();
		});
	}
}

StellarClient;
