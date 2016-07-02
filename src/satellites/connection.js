import UUID from 'node-uuid';

/**
 * Create a clean connection.
 *
 * @param connection  Connection object.
 * @returns {{}}      New clean connection object.
 */
let cleanConnection = connection => {
  let clean = {}

  for (let i in connection) {
    if (i !== 'rawConnection') { clean[ i ] = connection[ i ] }
  }

  return clean
}

class Connections {

  /**
   * API reference object.
   */
  api

  /**
   * Hash with all registered middleware.
   *
   * @type {{}}
   */
  middleware = {}

  /**
   * Array with global middleware.
   *
   * @type {Array}
   */
  globalMiddleware = []

  /**
   * Array with the allowed verbs.
   *
   * @type {string[]}
   */
  allowedVerbs = [
    'quit',
    'exit',
    'paramAdd',
    'paramDelete',
    'paramView',
    'paramsView',
    'paramsDelete',
    'roomAdd',
    'roomLeave',
    'roomView',
    'detailsView',
    'say'
  ]

  /**
   * Hash with the active connections.
   *
   * @type {{}}
   */
  connections = {}

  /**
   * Create a new class instance.
   *
   * @param api   API object reference.
   */
  constructor (api) { this.api = api }

  /**
   * Add a new middleware.
   *
   * @param data  Middleware to be added.
   */
  addMiddleware (data) {
    let self = this

    // middleware require a name
    if (!data.name) { throw new Error('middleware.name is required')}

    // if there is no defined priority use the default
    if (!data.priority) { data.priority = self.api.config.general.defaultMiddlewarePriority }

    // ensure the priority is a number
    data.priority = Number(data.priority)

    // save the new middleware
    self.middleware[ data.name ] = data

    // push the new middleware to the global list
    self.globalMiddleware.push(data.name)

    // sort the global middleware array
    self.globalMiddleware.sort((a, b) => {
      if (self.middleware[ a ].priority > self.middleware[ b ].priority) {
        return 1
      }

      return -1
    })
  }

  apply (connectionId, method, args, callback) {
    let self = this

    if (args === undefined && callback === undefined && typeof method === 'function') {
      callback = method
      args = null
      method = null
    }

    self.api.redis.doCluster('api.connections.applyCatch', [ connectionId, method, args ], connectionId, callback)
  }

  applyCatch (connectionId, method, args, callback) {
    let self = this

    let connection = self.api.connections.connections[ connectionId ]
    if (method && args) {
      if (method === 'sendMessage' || method === 'sendFile') {
        connection[ method ](args)
      } else {
        connection[ method ].apply(connection, args)
      }
    }

    if (typeof callback === 'function') {
      process.nextTick(() => { callback(cleanConnection(connection)) })
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
  api

  /**
   * Unique client identifier.
   */
  id

  /**
   * Timestamp of the connection.
   */
  connectedAt

  /**
   * Rooms which the client belongs.
   *
   * @type {Array}
   */
  rooms = []

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
  constructor (api, data) {
    let self = this

    self.api = api
    self._setup(data)

    // save this connection on the connection manager
    api.connections.connections[ self.id ] = self

    // execute the middleware
    self.api.connections.globalMiddleware.forEach(middlewareName => {
      if (typeof self.api.connections.middleware[ middlewareName ].create === 'function') {
        self.api.connections.middleware[ middlewareName ].create(self)
      }
    })
  }

  /**
   * Initialize the connection object.
   *
   * @param data
   * @private
   */
  _setup (data) {
    let self = this

    if (data.id) {
      self.id = data.id;
    } else {
      // generate an unique ID for this connection
      self.id = self._generateID()
    }

    // set the connection timestamp
    self.connectedAt = new Date().getTime();

    [ 'type', 'rawConnection' ].forEach(req => {
      if (data[ req ] === null || data[ req ] === undefined) {
        throw new Error(`${req} is required to create a new connection object`)
      }
      self[ req ] = data[ req ]
    });

    [ 'remotePort', 'remoteIP' ].forEach(req => {
      if (data[ req ] === null || data[ req ] === undefined) {
        if (self.api.config.general.enforceConnectionProperties === true) {
          throw new Error(`${req} is required to create a new connection object`)
        } else {
          data[ req ] = 0; // could be a random uuid as well?
        }
      }
      self[ req ] = data[ req ]
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
      canChat: false
    }

    for (let i in connectionDefaults) {
      if (self[ i ] === undefined && data[ i ] !== undefined) { self[ i ] = data[ i ] }
      if (self[ i ] === undefined) { self[ i ] = connectionDefaults[ i ] }
    }

    self.api.i18n.invokeConnectionLocale(self)
  }

  /**
   * Generate an unique identifier for this connection.
   *
   * @returns {*}
   * @private
   */
  _generateID () { return UUID.v4() }

  /**
   * Send a message to this connection.
   *
   * @param message
   */
  sendMessage (message) {
    throw new Error(`I should be replaced with a connection-specific method [${message}]`)
  }

  /**
   * Send a file to this connection.
   *
   * @param path
   */
  sendFile (path) {
    throw new Error(`I should be replaced with a connection-specific method [${path}]`)
  }

  /**
   * Localize a message.
   *
   * @param message   Message to be localized.
   */
  localize (message) {
    let self = this
    return self.api.i18n.localize(message, self)
  }

  destroy (callback) {
    let self = this

    // set connection as destroyed
    self.destroyed = true

    // execute the destroy middleware
    self.api.connections.globalMiddleware.forEach(middlewareName => {
      if (typeof self.api.connections.middleware[ middlewareName ].destroy === 'function') {
        self.api.connections.middleware[ middlewareName ].destroy(self)
      }
    })

    // remove the connection from all rooms
    if (self.canChat === true) {
      self.rooms.forEach(room => self.api.chatRoom.removeMember(self.id, room))
    }

    // get server instance
    let server = self.api.servers.servers[ self.type ]

    if (server) {
      if (server.attributes.logExits === true) {
        server.log('connection closed', 'info', {to: self.remoteIP})
      }

      if (typeof server.goodbye === 'function') { server.goodbye(self) }
    }

    // remove this connection from the connections array
    delete self.api.connections.connections[ self.id ]

    // execute the callback function
    if (typeof callback === 'function') { callback() }
  }

  /**
   * Set a new connection attribute.
   *
   * @param key
   * @param value
   */
  set (key, value) {
    let self = this
    self[ key ] = value
  }

  /**
   * Execute the right operation for the given verb.
   *
   * @param verb      Verb to be executed.
   * @param words     Words are optional.
   * @param callback  Callback function.
   */
  verbs (verb, words, callback) {
    let self = this

    let key, value, room
    let server = self.api.servers.servers[ self.type ]
    let allowedVerbs = server.attributes.verbs

    if (typeof words === 'function' && !callback) {
      callback = words
      words = []
    }

    if (!(words instanceof Array)) { words = [ words ] }

    if (server && allowedVerbs.indexOf(verb) >= 0) {
      // log verb message
      server.log('verb', 'debug', {verb: verb, to: self.remoteIP, params: JSON.stringify(words)})

      if (verb === 'quit' || verb === 'exit') {
        server.goodbye(self)
      } else if (verb === 'paramAdd') {
        key = words[ 0 ]
        value = words[ 1 ]

        if (words[ 0 ] && (words[ 0 ].indexOf('=') >= 0)) {
          let parts = words[ 0 ].split('=')
          key = parts[ 0 ]
          value = parts[ 1 ]
        }

        self.params[ key ] = value

        // execute the callback function
        if (typeof callback === 'function') { callback(null, null) }
      } else if (verb === 'paramDelete') {
        key = words[ 0 ]
        delete self.params[ key ]

        // execute the callback function
        if (typeof callback === 'function') { callback(null, null) }
      } else if (verb === 'paramView') {
        key = words[ 0 ]

        if (typeof callback === 'function') { callback(null, self.params[ key ]) }
      } else if (verb === 'paramsView') {
        if (typeof callback === 'function') { callback(null, self.params) }
      } else if (verb === 'paramsDelete') {
        // delete all params
        for (let i in self.params) { delete self.params[ i ] }

        if (typeof callback === 'function') { callback(null, null) }
      } else if (verb === 'roomAdd') {
        room = words[ 0 ]

        self.api.chatRoom.addMember(self.id, room, (error, didHappen) => {
          if (typeof callback === 'function') { callback(error, didHappen) }
        })
      } else if (verb === 'roomLeave') {
        room = words[ 0 ]
        self.api.chatRoom.removeMember(self.id, room, function (error, didHappen) {
          if (typeof callback === 'function') { callback(error, didHappen) }
        })
      } else if (verb === 'roomView') {
        // get requested room name
        room = words[ 0 ]

        if (self.rooms.indexOf(room) > -1) {
          self.api.chatRoom.roomStatus(room, (error, roomStatus) => {
            if (typeof callback === 'function') { callback(error, roomStatus) }
          })
        } else {
          if (typeof callback === 'function') { callback(`not member of room ${room}`) }
        }
      } else if (verb === 'detailsView') {
        let details = {
          id: self.id,
          fingerprint: self.fingerprint,
          remoteIP: self.remoteIP,
          remotePort: self.remotePort,
          params: self.params,
          connectedAt: self.connectedAt,
          rooms: self.rooms,
          totalActions: self.totalActions,
          pendingActions: self.pendingActions
        }

        // execute the callback function
        if (typeof callback === 'function') { callback(null, details) }

      } else if (verb === 'say') {
        // get the room name
        room = words.shift()

        // broadcast the message on the requested room
        self.api.chatRoom.broadcast(self, room, words.join(' '), error => {
          if (typeof callback === 'function') { callback(error) }
        })
      } else {
        if (typeof callback === 'function') {
          callback(self.api.config.errors.verbNotFound(self, verb), null)
        }
      }
    } else {
      if (typeof callback === 'function') {
        callback(self.api.config.errors.verbNotAllowed(self, verb), null)
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
  loadPriority = 400

  /**
   * Satellite load function.
   *
   * @param api   API reference object.
   * @param next  Callback function.
   */
  load (api, next) {
    // put Connections instance available to all platform
    api.connections = new Connections(api)

    // put the connection Class available to all platform
    api.connection = Connection

    // finish the loading process
    next()
  }

}
