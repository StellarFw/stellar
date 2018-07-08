'use strict'

/**
 * Array of Interceptors
 *
 * This is used to process before and after HTTP processing and WebSokcet.
 *
 * @type {Array}
 */
StellarClient.prototype.interceptors = []

// ----------------------------------------------------------------------------- [Pending Requests]

// ----------------------------------------------------------------------------- [Messaging]

/**
 * Handle message.
 *
 * @param message
 */
StellarClient.prototype.handleMessage = function (message) {
  this._emit('message', message)

  if (message.context === 'response') {
    if (typeof this.callbacks[ message.messageCount ] === 'function') {
      this.callbacks[ message.messageCount ](message)
    }

    delete this.callbacks[ message.messageCount ]
  } else if (message.context === 'user') { // TODO this must be changed in order to support events
    // emit a global event
    this._emit('say', message)

    // check if it's an event and emit the correct events
    if (message.message.event) {
      const packet = message.message

      // emit event into global scope
      this._emit(packet.event, packet.data, message)

      // emit an event specific for a given room
      this._emit(`[${message.room}].${packet.event}`, packet.data, message)
    }
  } else if (message.context === 'alert') {
    this._emit('alert', message)
  } else if (message.welcome && message.context === 'api') {
    this.welcomeMessage = message.welcome
    this._emit('welcome', message)
  } else if (message.context === 'api') {
    this._emit('api', message)
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
StellarClient.prototype._actionWeb = async function (params) {
  // define the HTTP method to be used (by default we use POST)
  const method = (params.httpMethod || 'POST').toUpperCase()

  // define the URL to be called and append the action on the query params
  let url = `${this.options.url}${this.options.apiPath}?action=${params.action}`

  // when it's a GET request we must append the params to the URL address
  if (method === 'GET') {
    for (let param in params) {
      if (~[ 'action', 'httpMethod' ].indexOf(param)) { continue }
      url += `&${param}=${params[ param ]}`
    }
  }

  // build request options
  const options = {
    method,
    mode: 'cors',
    headers: new Headers({
      'Content-Type': 'application/json'
    })
  }

  // if it's a POST request we need to append the params to the request body
  if (method === 'POST') { options.body = JSON.stringify(params) }

  // build a new request instance
  const request = new Request(url, options)

  // make the request
  const response = await fetch(request)

  // catch errors
  if (response.status !== 200) { throw await response.json() }

  // return as a success message
  return response.json()
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


exports.StellarClient = StellarClient
