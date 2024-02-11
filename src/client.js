"use strict";

/* global Primus fetch Headers Request */

// ----------------------------------------------------------------------------- [Util Functions]

const warn = (msg) => console.warn(`[StellarClient warn]: ${msg}`);

const error = (msg) => console.error(`[StellarClient error]: ${msg}`);

const isFunction = (val) => typeof val === "function";

const isObject = (obj) => obj !== null && typeof obj === "object";

// ----------------------------------------------------------------------------- [Build Event]

class Build {
  /**
   * Create a new instance.
   *
   * @param room    Room to add to the builder.
   * @param client  Stellar client instance.
   */
  constructor(room, client) {
    // save client instance
    this.client = client;

    // store the room
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
   * @returns {Build}   The instance of this class.
   * @private
   */
  _innerRoomAdd(room) {
    // we can also accept arrays, so we need to concat them in that case. Otherwise, push the new room.
    if (Array.isArray(room)) {
      this.rooms = this.rooms.concat(room);
    } else {
      this.rooms.push(room);
    }

    // return the current instance
    return this;
  }

  /**
   * Add a new room where the event must be sent.
   *
   * @param room New room to append, or an array.
   */
  to(room) {
    return this._innerRoomAdd(room);
  }

  /**
   * Send the event to the server.
   *
   * We send an event for each room.
   *
   * @param event   Event name.
   * @param data    data to send with the event.
   */
  emit(event, data) {
    const work = [];

    // send an event for each room, and store the Promise on the array
    this.rooms.forEach((room) => {
      work.push(
        this.client.send({ event: "event", params: { room, event, data } }),
      );
    });

    // return an array of Promises
    return Promise.all(work);
  }

  /**
   * Add a new room, to filter the event handler.
   *
   * @param room        Room to filter.
   * @returns {Build}   Instance of this class.
   */
  from(room) {
    return this._innerRoomAdd(room);
  }

  /**
   * Handle an event reception.
   *
   * @param event     Event name.
   * @param callback  Event handler.
   */
  on(event, callback) {
    // create an handler for each room
    this.rooms.forEach((room) => {
      this.client.on(`[${room}].${event}`, callback);
    });

    // return this instance
    return this;
  }

  off(event, func) {
    // for each selected room we must remove the requested event.
    this.rooms.forEach((room) => {
      this.client.removeListener(`[${room}].${event}`, func);
    });

    // return this instance
    return this;
  }
}

// ----------------------------------------------------------------------------- [Stellar Client]

/**
 * Interface for WebSocket client interact with the server.
 *
 * @param opts    Connections parameters.
 * @param client  Client object (if exists).
 * @constructor
 */
const StellarClient = function (opts, client) {
  this.callbacks = {};
  this.id = null;
  this.events = {};
  this.rooms = [];
  this.state = "disconnected";
  this.messageCount = 0;

  // Array to store the pending requests to made and a counter with the number of pending requests
  this.pendingRequestsQueue = [];
  this.pendingRequestsCounter = 0;

  this.options = this.defaults() || {};

  // override default options
  for (const i in opts) {
    this.options[i] = opts[i];
  }

  if (client) {
    this.externalClient = true;
    this.client = client;
  }

  // this must print out an error when the Promise object can't be found
  if (Promise === undefined || typeof Promise !== "function") {
    error(
      "The browser does not support Promises, you must load a polyfill before load Stellar client lib",
    );
  }
};

if (typeof Primus === "undefined") {
  const util = require("util");
  const EventEmitter = require("events").EventEmitter;
  util.inherits(StellarClient, EventEmitter);
} else {
  StellarClient.prototype = new Primus.EventEmitter();
}

/**
 * Array of Interceptors
 *
 * This is used to process before and after HTTP processing and WebSokcet.
 *
 * @type {Array}
 */
StellarClient.prototype.interceptors = [];

StellarClient.prototype.defaults = function () {
  return "%%DEFAULTS%%";
};

StellarClient.prototype.connect = function () {
  this.messageCount = 0;

  return new Promise((resolve, reject) => {
    if (this.client && this.externalClient !== true) {
      this.client.end();
      this.client.removeAllListeners();
      this.client = Primus.connect(this.options.url, this.options);
    } else if (this.client !== null && this.externalClient === true) {
      this.client.end();
      this.client.open();
    } else {
      this.client = Primus.connect(this.options.url, this.options);
    }

    // --- define client event handlers

    // open
    this.client.on("open", () => {
      this.configure().then((details) => {
        if (this.state !== "connected") {
          this.state = "connected";
          resolve(details);
        }

        this._emit("connected");
      });
    });

    // error
    this.client.on("error", (err) => {
      reject(err);
      this._emit("error", err);
    });

    // reconnect
    this.client.on("reconnect", () => {
      this.messageCount = 0;
      this._emit("reconnect");
    });

    // reconnecting
    this.client.on("reconnecting", () => {
      this._emit("reconnecting");
      this.state = "reconnecting";
      this._emit("disconnected");
    });

    // timeout
    this.client.on("timeout", () => {
      this.state = "timeout";
      this._emit("timeout");
    });

    // end
    this.client.on("end", () => {
      this.messageCount = 0;

      if (this.state !== "disconnected") {
        this.state = "disconnected";
        this._emit("disconnected");
      }
    });

    // data
    this.client.on("data", (data) => this.handleMessage(data));
  });
};

StellarClient.prototype.configure = function () {
  return new Promise((resolve) => {
    // join to all default rooms
    if (this.options.rooms) {
      this.options.rooms.forEach((room) =>
        this.send({ event: "roomAdd", room }),
      );
    }

    // request the connection details
    this.detailsView().then((details) => {
      // save connection information
      this.id = details.data.id;
      this.fingerprint = details.data.fingerprint;
      this.rooms = details.data.rooms;

      resolve(details);
    });
  });
};

// ----------------------------------------------------------------------------- [Pending Requests]

/**
 * Process the next pending request if available.
 */
StellarClient.prototype.processNextPendingRequest = function () {
  // check if there is some pending request to be processes
  if (this.pendingRequestsQueue.length === 0) {
    return;
  }

  // get the next request to be processed
  const requestFn = this.pendingRequestsQueue.shift();

  // execute the process
  requestFn();
};

// ----------------------------------------------------------------------------- [Messaging]

/**
 * Send a message.
 *
 * @param args
 * @return Promise
 */
StellarClient.prototype.send = function (args) {
  return new Promise((resolve) => {
    // primus will buffer messages when nor connected
    this.messageCount++;

    // add the resolve function as the callback for this message
    this.callbacks[this.messageCount] = resolve;

    // send the message to the server
    this.client.write(args);
  });
};

/**
 * Handle message.
 *
 * @param message
 */
StellarClient.prototype.handleMessage = function (message) {
  this._emit("message", message);

  if (message.context === "response") {
    if (typeof this.callbacks[message.messageCount] === "function") {
      this.callbacks[message.messageCount](message);
    }

    delete this.callbacks[message.messageCount];
  } else if (message.context === "user") {
    // TODO this must be changed in order to support events
    // emit a global event
    this._emit("say", message);

    // check if it's an event and emit the correct events
    if (message.message.event) {
      const packet = message.message;

      // emit event into global scope
      this._emit(packet.event, packet.data, message);

      // emit an event specific for a given room
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
};

// ----------------------------------------------------------------------------- [Actions]

/**
 * Call an action.
 *
 * If this client instance are connected use WebSocket, otherwise use a normal
 * HTTP request. This makes possible call actions as soon as the web app is
 * loaded.
 *
 * @param action   Name of the action to be called.
 * @param params   Action parameters.
 * @return Promise
 */
StellarClient.prototype.action = function (action, params = {}) {
  return new Promise((resolve, reject) => {
    // contains the reference for the current handler
    let handler = null;

    // array with the request interceptor. We need to make a copy to keep the
    // original array intact
    const reqHandlers = this.interceptors.slice(0);

    // array with the response handlers. this is local to avoid repetition
    const resHandlers = [];

    // sets the parameter action, in case of the action call be done over HTTP.
    params.action = action;

    // callback to pass to the interceptors
    const next = (response, error) => {
      // whether error is defined the promise is rejected
      if (error !== undefined && error !== null) {
        // execute all the response handlers
        resHandlers.forEach((h) => {
          h.call(this, error);
        });

        return reject(error);
      }

      if (isFunction(response)) {
        // add the function to the response handlers
        resHandlers.unshift(response);
      } else if (isObject(response)) {
        // execute all the response handlers
        resHandlers.forEach((h) => {
          h.call(this, response);
        });

        return resolve(response);
      }

      exec();
    };

    const exec = () => {
      // if there is no more request handlers to process we must perform the
      // request
      if (reqHandlers.length === 0) {
        let method = null;

        // if the client is connected the connection should be done by WebSocket
        // otherwise we need to use HTTP
        if (this.state !== "connected") {
          method = this._actionWeb;
        } else {
          method = this._actionWebSocket;
        }

        // increment the number of pending requests
        this.pendingRequestsCounter += 1;

        // calling this function will make process the requests
        const processRequest = () => {
          // make the request
          method
            .call(this, params)
            .then((res) => {
              next(res);
            })
            .catch((error) => {
              next(null, error);
            })
            .then(() => {
              // decrement the number of pending responses
              this.pendingRequestsCounter -= 1;

              // process the next request
              this.processNextPendingRequest();
            });
        };

        // if the number of pending request is bigger than the server limit, the request must be
        // placed on the a queue to be processed later.
        if (this.pendingRequestsCounter >= this.options.simultaneousActions) {
          return this.pendingRequestsQueue.push(processRequest);
        }

        // we can make the request now
        processRequest();
        return;
      }

      // get the next handle to be processed
      handler = reqHandlers.pop();

      // execute the next handler if it is a function, otherwise print out an
      // warning and processed to the handler
      if (isFunction(handler)) {
        handler.call(this, params, next, reject);
      } else {
        warn(
          `Invalid interceptor of type ${typeof handler}, must be a function`,
        );
        next();
      }
    };

    // start processing the interceptors
    exec();
  });
};

/**
 * Call a action using a normal HTTP connection.
 *
 * @param params    Call parameters.
 * @return Promise
 * @private
 */
StellarClient.prototype._actionWeb = async function (params) {
  // define the HTTP method to be used (by default we use POST)
  const method = (params.httpMethod || "POST").toUpperCase();

  // define the URL to be called and append the action on the query params
  let url = `${this.options.url}${this.options.apiPath}?action=${params.action}`;

  // when it's a GET request we must append the params to the URL address
  if (method === "GET") {
    for (let param in params) {
      if (~["action", "httpMethod"].indexOf(param)) {
        continue;
      }
      url += `&${param}=${params[param]}`;
    }
  }

  // build request options
  const options = {
    method,
    mode: "cors",
    headers: new Headers({
      "Content-Type": "application/json",
    }),
  };

  // if it's a POST request we need to append the params to the request body
  if (method === "POST") {
    options.body = JSON.stringify(params);
  }

  // build a new request instance
  const request = new Request(url, options);

  // make the request
  const response = await fetch(request);

  // catch errors
  if (response.status !== 200) {
    throw await response.json();
  }

  // return as a success message
  return response.json();
};

/**
 * Send an action call request by WebSocket.
 *
 * @param params    Call parameters.
 * @return Promise
 * @private
 */
StellarClient.prototype._actionWebSocket = function (params) {
  // we need to wrap this into a promise because the send method needs to be
  // generic to handle other real-time features. So, here we need to check if
  // there is an error.
  return new Promise((resolve, reject) => {
    this.send({ event: "action", params }).then((response) => {
      if (response.error !== undefined) {
        reject(response);
        return;
      }

      resolve(response);
    });
  });
};

// ----------------------------------------------------------------------------- [Commands]

// save the original emit method to use as local event emitter
StellarClient.prototype._emit = StellarClient.prototype.emit;

/**
 * Send an event to the server.
 *
 * @param event   Event name.
 * @param data    Data to send with the event. This can be optional.
 */
StellarClient.prototype.emit = function (event = null, data = null) {
  // get default room
  const room = this.options.defaultRoom;

  // send a new message to the server
  return this.send({ event: "event", params: { event, room, data } });
};

/**
 * Send an event to a specific room.
 *
 * @param room
 * @returns {Build}
 */
StellarClient.prototype.to = function (room) {
  return new Build(room, this);
};

/**
 * Receive an event to a specific room.
 *
 * @param room
 * @returns {Build}
 */
StellarClient.prototype.from = function (room) {
  return new Build(room, this);
};

/**
 * Remove a listener for a a given event,
 *
 * @param event Event name.
 * @param func  Listener to be removed.
 * @returns {EventEmitter} The event emitter instance.
 */
StellarClient.prototype.off = function (event, func) {
  return this.removeListener(event, func);
};

/**
 * Send a message to a room.
 *
 * @param room      Room name.
 * @param message   Message to be sent.
 * @return Promise
 */
StellarClient.prototype.say = function (room, message) {
  // set default room as target, and set message with the first argument
  if (message === undefined) {
    message = room;
    room = this.options.defaultRoom;
  }

  // emit a 'say' event for the selected room
  return this.to(room).emit("message", message);
};

/**
 * Make a file request.
 *
 * @param file  File to be requested.
 * @return Promise
 */
StellarClient.prototype.file = function (file) {
  return this.send({ event: "file", file });
};

/**
 * Request the details view.
 *
 * @return Promise
 */
StellarClient.prototype.detailsView = function () {
  return this.send({ event: "detailsView" });
};

/**
 * Request a room state.
 *
 * @param room  Room name.
 * @return Promise
 */
StellarClient.prototype.roomView = function (room) {
  return this.send({ event: "roomView", room });
};

/**
 * Create a new room.
 *
 * @param room  Name for the room to be created.
 * @return Promise
 */
StellarClient.prototype.join = async function (room) {
  await this.send({ event: "roomJoin", room });

  // configure connection
  return this.configure();
};

/**
 * Leave a room.
 *
 * @param room  Name the to leave.
 * @return Promise
 */
StellarClient.prototype.leave = async function (room) {
  // get the position of the room on the client rooms list
  let index = this.rooms.indexOf(room);

  // remove the room from the client room list
  if (index > -1) {
    this.rooms.splice(index, 1);
  }

  // make a server request to remove the client from the room
  await this.send({ event: "roomLeave", room: room });

  // configure the connection
  return this.configure();
};

/**
 * Disconnect the client from the server.
 */
StellarClient.prototype.disconnect = function () {
  // change the connection state to disconnected
  this.state = "disconnected";

  // finish the connection between the client and the server
  this.client.end();

  // emit the 'disconnected' event
  this._emit("disconnected");
};

exports.StellarClient = StellarClient;
