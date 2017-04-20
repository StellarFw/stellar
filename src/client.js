/* global Primus XMLHttpRequest */

// ----------------------------------------------------------------------------- [Util Functions]

const warn = msg => console.warn(`[StellarClient warn]: ${msg}`)

const error = msg => console.error(`[StellarClient error]: ${msg}`)

const isFunction = val => typeof val === 'function'

const isObject = obj => obj !== null && typeof obj === 'object'

// ----------------------------------------------------------------------------- [Stellar Client]

/**
 * Interface for WebSocket client interact with the server.
 *
 * @param opts    Connections parameters.
 * @param client  Client object (if exists).
 * @constructor
 */
const StellarClient = function (opts, client) {
  this.callbacks = {}
  this.id = null
  this.events = {}
  this.rooms = []
  this.state = 'disconnected'
  this.messageCount = 0

  // Array to store the pending requests to made and a counter with the number of pending requests
  this.pendingRequestsQueue = []
  this.pendingRequestsCounter = 0

  this.options = this.defaults() || {}

  // override default options
  for (const i in opts) { this.options[ i ] = opts[ i ] }

  if (client) {
    this.externalClient = true
    this.client = client
  }

  // this must print out an error when the Promise object can't be found
  if (Promise === undefined || typeof Promise !== 'function') {
    error('The browser does not support Promises, you must load a polyfill before load Stellar client lib')
  }
}

if (typeof Primus === 'undefined') {
  const util = require('util')
  const EventEmitter = require('events').EventEmitter
  util.inherits(StellarClient, EventEmitter)
} else {
  StellarClient.prototype = new Primus.EventEmitter()
}

/**
 * Array of Interceptors
 *
 * This is used to process before and after HTTP processing and WebSokcet.
 *
 * @type {Array}
 */
StellarClient.prototype.interceptors = []

StellarClient.prototype.defaults = function () { return '%%DEFAULTS%%' }

StellarClient.prototype.connect = function () {
  this.messageCount = 0

  return new Promise((resolve, reject) => {
    if (this.client && this.externalClient !== true) {
      this.client.end()
      this.client.removeAllListeners()
      this.client = Primus.connect(this.options.url, this.options)
    } else if (this.client !== null && this.externalClient === true) {
      this.client.end()
      this.client.open()
    } else {
      this.client = Primus.connect(this.options.url, this.options)
    }

    // --- define client event handlers

    // open
    this.client.on('open', () => {
      this.configure().then(details => {
        if (this.state !== 'connected') {
          this.state = 'connected'
          resolve(details)
        }

        this.emit('connected')
      })
    })

    // error
    this.client.on('error', err => {
      this.emit('error', err)
    })

    // reconnect
    this.client.on('reconnect', () => {
      this.messageCount = 0
      this.emit('reconnect')
    })

    // reconnecting
    this.client.on('reconnecting', () => {
      this.emit('reconnecting')
      this.state = 'reconnecting'
      this.emit('disconnected')
    })

    // timeout
    this.client.on('timeout', () => {
      this.state = 'timeout'
      this.emit('timeout')
    })

    // end
    this.client.on('end', () => {
      this.messageCount = 0

      if (this.state !== 'disconnected') {
        this.state = 'disconnected'
        this.emit('disconnected')
      }
    })

    // data
    this.client.on('data', data => this.handleMessage(data))
  })
}

StellarClient.prototype.configure = function () {
  return new Promise(resolve => {
    // join to all default rooms
    if (this.options.rooms) {
      this.options.rooms.forEach(room => this.send({ event: 'roomAdd', room }))
    }

    // request the connection details
    this.detailsView().then(details => {
      // save connection information
      this.id = details.data.id
      this.fingerprint = details.data.fingerprint
      this.rooms = details.data.rooms

      resolve(details)
    })
  })
}

// ----------------------------------------------------------------------------- [Pending Requests]

/**
 * Process the next pending request if available.
 */
StellarClient.prototype.processNextPendingRequest = function () {
  // check if there is some pending request to be processes
  if (this.pendingRequestsQueue.length === 0) { return }

  // get the next request to be processed
  const requestFn = this.pendingRequestsQueue.shift()

  // execute the process
  requestFn()
}

// ----------------------------------------------------------------------------- [Messaging]

/**
 * Send a message.
 *
 * @param args
 * @return Promise
 */
StellarClient.prototype.send = function (args) {
  return new Promise(resolve => {
    // primus will buffer messages when nor connected
    this.messageCount++

    // add the resolve function as the callback for this message
    this.callbacks[this.messageCount] = resolve

    // send the message to the server
    this.client.write(args)
  })
}

/**
 * Handle message.
 *
 * @param message
 */
StellarClient.prototype.handleMessage = function (message) {
  this.emit('message', message)

  if (message.context === 'response') {
    if (typeof this.callbacks[ message.messageCount ] === 'function') {
      this.callbacks[ message.messageCount ](message)
    }

    delete this.callbacks[ message.messageCount ]
  } else if (message.context === 'user') {
    this.emit('say', message)
  } else if (message.context === 'alert') {
    this.emit('alert', message)
  } else if (message.welcome && message.context === 'api') {
    this.welcomeMessage = message.welcome
    this.emit('welcome', message)
  } else if (message.context === 'api') {
    this.emit('api', message)
  }
}

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
    let handler = null

    // array with the request interceptor. We need to make a copy to keep the
    // original array intact
    const reqHandlers = this.interceptors.slice(0)

    // array with the response handlers. this is local to avoid repetition
    const resHandlers = []

    // sets the parameter action, in case of the action call be done over HTTP.
    params.action = action

    // callback to pass to the interceptors
    const next = (response, error) => {
      // whether error is defined the promise is rejected
      if (error !== undefined && error !== null) {
        // execute all the response handlers
        resHandlers.forEach(h => { h.call(this, error) })

        return reject(error)
      }

      if (isFunction(response)) {
        // add the function to the response handlers
        resHandlers.unshift(response)
      } else if (isObject(response)) {
        // execute all the response handlers
        resHandlers.forEach(h => { h.call(this, response) })

        return resolve(response)
      }

      exec()
    }

    const exec = () => {
      // if there is no more request handlers to process we must perform the
      // request
      if (reqHandlers.length === 0) {
        let method = null

        // if the client is connected the connection should be done by WebSocket
        // otherwise we need to use HTTP
        if (this.state !== 'connected') {
          method = this._actionWeb
        } else {
          method = this._actionWebSocket
        }

        // increment the number of pending requests
        this.pendingRequestsCounter += 1

        // calling this function will make process the requests
        const processRequest = () => {
          // make the request
          method.call(this, params)
            .then(res => { next(res) })
            .catch(error => { next(null, error) })
            .then(() => {
              // decrement the number of pending responses
              this.pendingRequestsCounter -= 1

              // process the next request
              this.processNextPendingRequest()
            })
        }

        // if the number of pending request is bigger than the server limit, the request must be
        // placed on the a queue to be processed later.
        if (this.pendingRequestsCounter >= this.options.simultaneousActions) {
          return this.pendingRequestsQueue.push(processRequest)
        }

        // we can make the request now
        processRequest()
        return
      }

      // get the next handle to be processed
      handler = reqHandlers.pop()

      // execute the next handler if it is a function, otherwise print out an
      // warning and processed to the handler
      if (isFunction(handler)) {
        handler.call(this, params, next, reject)
      } else {
        warn(`Invalid interceptor of type ${typeof handler}, must be a function`)
        next()
      }
    }

    // start processing the interceptors
    exec()
  })
}

/**
 * Call a action using a normal HTTP connection.
 *
 * @param params    Call parameters.
 * @return Promise
 * @private
 */
StellarClient.prototype._actionWeb = function (params) {
  return new Promise((resolve, reject) => {
    // create a new XMLHttpRequest instance
    const xmlhttp = new XMLHttpRequest()

    // define the action to be executed at the end of the request
    xmlhttp.onreadystatechange = () => {
      let response = null

      // the response only are received if the readyState is equals to 4
      if (xmlhttp.readyState === 4) {
        // if the HTTP status code is equals to 200 make a JSON parser.
        // in case of the request code be different of 200 we try make
        // a JSON parser too, but it can fail so we catch the exception
        // and we make our own error message
        if (xmlhttp.status === 200) {
          response = JSON.parse(xmlhttp.responseText)

          resolve(response)
        } else {
          try {
            response = JSON.parse(xmlhttp.responseText)
          } catch (e) {
            response = { error: { statusText: xmlhttp.statusText, responseText: xmlhttp.responseText } }
          }

          reject(response)
        }
      }
    }

    // define the HTTP method to be used (by default we use POST)
    const method = (params.httpMethod || 'POST').toUpperCase()

    // define the URL to be called and append the action on the query params
    let url = `${this.options.url}${this.options.apiPath}?action=${params.action}`

    if (method === 'GET') {
      for (let param in params) {
        if (~[ 'action', 'httpMethod' ].indexOf(param)) { continue }
        url += `&${param}=${params[ param ]}`
      }
    }

    // open a new connection
    xmlhttp.open(method, url, true)

    // det the content type to JSON
    xmlhttp.setRequestHeader('Content-Type', 'application/json')

    // send the request
    xmlhttp.send(JSON.stringify(params))
  })
}

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
    this.send({ event: 'action', params })
      .then(response => {
        if (response.error !== undefined) {
          reject(response)
          return
        }

        resolve(response)
      })
  })
}

// ----------------------------------------------------------------------------- [Commands]

/**
 * Send a message to a room.
 *
 * @param room      Room name.
 * @param message   Message to be sent.
 * @return Promise
 */
StellarClient.prototype.say = function (room, message) {
  return this.send({ event: 'say', room, message })
}

/**
 * Make a file request.
 *
 * @param file  File to be requested.
 * @return Promise
 */
StellarClient.prototype.file = function (file) {
  return this.send({ event: 'file', file })
}

/**
 * Request the details view.
 *
 * @return Promise
 */
StellarClient.prototype.detailsView = function () {
  return this.send({ event: 'detailsView' })
}

/**
 * Request a room state.
 *
 * @param room  Room name.
 * @return Promise
 */
StellarClient.prototype.roomView = function (room) {
  return this.send({ event: 'roomView', room })
}

/**
 * Create a new room.
 *
 * @param room  Name for the room to be created.
 * @return Promise
 */
StellarClient.prototype.roomAdd = function (room) {
  return this.send({ event: 'roomAdd', room }).then(data => this.configure())
}

/**
 * Leave a room.
 *
 * @param room  Name the to leave.
 * @return Promise
 */
StellarClient.prototype.roomLeave = function (room) {
  // get the position of the room on the client rooms list
  let index = this.rooms.indexOf(room)

  // remove the room from the client room list
  if (index > -1) { this.rooms.splice(index, 1) }

  // make a server request to remove the client from the room
  return this.send({ event: 'roomLeave', room: room })
    .then(data => this.configure())
}

/**
 * Disconnect the client from the server.
 */
StellarClient.prototype.disconnect = function () {
  // change the connection state to disconnected
  this.state = 'disconnected'

  // finish the connection between the client and the server
  this.client.end()

  // emit the 'disconnected' event
  this.emit('disconnected')
}

exports.StellarClient = StellarClient
