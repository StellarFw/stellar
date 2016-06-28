import async from 'async'
import Utils from '../utils'

class ChatRooms {

  /**
   * API reference.
   *
   * @type {null}
   */
  api = null

  /**
   * Keys to use to save rooms and members on redis server.
   *
   * @type {{rooms: string, members: string}}
   */
  keys = {
    rooms: 'stellar:chatRoom:rooms',
    members: 'stellar:chatRoom:members'
  }

  /**
   * List of globals middleware.
   *
   * @type {Array}
   */
  globalMiddleware = []

  /**
   * List of all middleware.
   *
   * @type {{}}
   */
  middleware = {}

  /**
   * Constructor.
   *
   * @param api API reference.
   */
  constructor (api) { this.api = api }

  /**
   * Add a new middleware to the chat room manager.
   *
   * @param data  Middleware object.
   */
  addMiddleware (data) {
    let self = this

    // middleware must have a name
    if (!data.name) { throw new Error('middleware.name is required') }

    // if the middleware don't have a priority set a default value
    if (!data.priority) { data.priority = self.api.config.general.defaultMiddlewarePriority }

    // ensure the priority is a number
    data.priority = Number(data.priority)

    // save the middleware object
    self.middleware[ data.name ] = data

    // push the middleware name to the globalMiddleware
    self.globalMiddleware.push(data.name)

    // sort the globalMiddleware by priority
    self.globalMiddleware.sort((a, b) => {
      if (self.middleware[ a ].priority > self.middleware[ b ].priority) {
        return 1
      } else {
        return -1
      }
    })
  }

  /**
   * Broadcast a message in a room.
   *
   * @param connection  Source connection.
   * @param room        Room here the message need to be broadcast.
   * @param message     Message to broadcast.
   * @param callback    Callback function.
   */
  broadcast (connection, room, message, callback) {
    let self = this

    // check if the room are present
    if (!room || room.length === 0 || message === null || message.length === 0) {
      if (typeof callback === 'function') {
        process.nextTick(() => callback(self.api.config.errors.connectionRoomAndMessage(connection)))
      }
    } else if (connection.rooms === undefined || connection.rooms.indexOf(room) > -1) {
      // set id zero for default if there no one present
      if (connection.id === undefined) { connection.id = 0 }

      // create a new payload
      let payload = {
        messageType: 'chat',
        serverToken: self.api.config.general.serverToken,
        serverId: self.api.id,
        message: message,
        sentAt: new Date().getTime(),
        connection: {
          id: connection.id,
          room: room
        }
      }

      // generate the message payload
      let messagePayload = self._generateMessagePayload(payload)

      // handle callbacks
      self._handleCallbacks(connection, messagePayload.room, 'onSayReceive', messagePayload, (error, newPayload) => {
        // if an error occurs execute the callback and send the error with him
        if (error) {
          if (typeof callback === 'function') {
            process.nextTick(() => { callback(error) })
          }
          return
        }

        // create the payload to send
        let payloadToSend = {
          messageType: 'chat',
          serverToken: self.api.config.general.serverToken,
          serverId: self.api.id,
          message: newPayload.message,
          sentAt: newPayload.sentAt,
          connection: {
            id: newPayload.id,
            room: newPayload.room
          }
        }

        // send the payload to redis
        self.api.redis.publish(payloadToSend)

        // execute the callback
        if (typeof callback === 'function') {
          process.nextTick(() => {
            callback(null)
          })
        }
      })
    } else {
      if (typeof callback === 'function') {
        process.nextTick(() => {
          callback(self.api.config.errors.connectionNotInRoom(connection, room))
        })
      }
    }
  }

  /**
   * Process an incoming message.
   *
   * @param message Incoming message to be processed.
   */
  incomingMessage (message) {
    let self = this

    // generate the message payload
    let messagePayload = self._generateMessagePayload(message)

    // iterate all connection
    for (let i in self.api.connections.connections) {
      self._incomingMessagePerConnection(self.api.connections.connections[ i ], messagePayload);
    }
  }

  /**
   * List rooms.
   *
   * @param callback
   */
  list (callback) {
    let self = this

    self.api.redis.clients.client.smembers(self.api.chatRoom.keys.rooms, (error, rooms) => {
      if (typeof callback === 'function') { callback(error, rooms) }
    })
  }

  /**
   * Create a new room.
   *
   * @param room      Name of the room to be created.
   * @param callback  Callback function.
   */
  add (room, callback) {
    let self = this

    // check if the room already exists
    self.exists(room, (err, found) => {
      // if the room already exists return an error
      if (found === true) {
        if (typeof callback === 'function') { callback(self.api.config.errors.connectionRoomExists(room), null) }
        return
      }

      // create a new room
      self.api.redis.client.sadd(self.keys.rooms, room, (err, count) => {
        if (typeof callback === 'function') { callback(err, count) }
      })
    })
  }

  /**
   * Destroy a room.
   *
   * @param room      Room to be destroyed.
   * @param callback  Callback function.
   */
  destroy (room, callback) {
    let self = this

    // check if the room exists
    self.exists(room, (error, found) => {
      // return an error if the room not exists
      if (found === false) {
        if (typeof callback === 'function') { callback(self.api.config.errors.connectionRoomNotExist(room), null) }
        return
      }

      // broadcast the room destruction
      self.broadcast({}, room, self.api.config.errors.connectionRoomHasBeenDeleted(room), () => {
        // get all room members
        self.api.redis.client.hgetall(self.keys.members + room, (error, memberHash) => {
          // remove each member from the room
          for (let id in memberHash) { self.removeMember(id, room) }

          // delete de room on redis server
          self.api.redis.client.srem(self.keys.rooms, room, () => {
            if (typeof callback === 'function') { callback() }
          })
        })
      })
    })
  }

  /**
   * Check if the given room exists.
   *
   * @param room      Name of the room.
   * @param callback  Callback function.
   */
  exists (room, callback) {
    let self = this

    // make a call to the redis server to check if the room exists
    self.api.redis.client.sismember(self.keys.rooms, room, (err, bool) => {
      let found = false

      if (bool === 1 || bool === true) { found = true }

      // execute the callback
      if (typeof callback === 'function') { callback(err, found) }
    })
  }

  /**
   * Get the status of a room.
   *
   * @param room      Name of the room to check.
   * @param callback  Callback function.
   */
  roomStatus (room, callback) {
    let self = this

    // we need a room to check their status
    if (room === undefined || room === null) {
      if (typeof callback === 'function') { callback(self.api.config.errors.connectionRoomRequired(), null) }
      return
    }

    // check if the room exists
    self.exists(room, (err, found) => {
      // the room need exists
      if (found !== true) {
        if (typeof callback === 'function') { callback(self.api.config.errors.connectionRoomNotExist(room), null) }
        return
      }

      // generate the key
      let key = self.keys.members + room

      // get all channel members
      self.api.redis.client.hgetall(key, (error, members) => {
        let cleanedMembers = {}
        let count = 0

        // iterate all members and add them to the list of members
        for (let id in members) {
          let data = JSON.parse(members[ id ])
          cleanedMembers[ id ] = self._sanitizeMemberDetails(data)
          count++
        }

        // execute the callback
        callback(null, {
          room: room,
          members: cleanedMembers,
          membersCount: count
        })
      })
    })
  }

  /**
   * Add a new member to a room.
   *
   * @param connectionId  Connection ID.
   * @param room          Room name where the client must be added.
   * @param callback      Callback function.
   */
  addMember (connectionId, room, callback) {
    let self = this

    // if the connection not exists create a new one in every stellar instance and return
    if (!self.api.connections.connections[ connectionId ]) {
      self.api.redis.doCluster('api.chatRoom.addMember', [ connectionId, room ], connectionId, callback)
      return
    }

    // get connection object
    let connection = self.api.connections.connections[ connectionId ]

    // verifies that the connection is already within the room, if yes return now
    if (connection.rooms.indexOf(room) > -1) {
      if (typeof callback === 'function') { callback(self.api.config.errors.connectionAlreadyInRoom(connection, room), false) }
      return
    }

    // check if the room exists
    self.exists(room, (error, found) => {
      if (found !== true) {
        if (typeof callback === 'function') { callback(self.api.config.errors.connectionRoomNotExist(room), false) }
        return
      }

      self._handleCallbacks(connection, room, 'join', null, error => {
        // if exists an error, execute the callback and return
        if (error) { return callback(error, false) }

        // generate the member details
        let memberDetails = self._generateMemberDetails(connection)

        self.api.redis.client.hset(self.keys.members + room, connection.id, JSON.stringify(memberDetails), () => {
          connection.rooms.push(room)
          if (typeof callback === 'function') { callback(null, true) }
        })
      })
    })
  }

  /**
   * Remove a client from a chat room.
   *
   * @param connectionId    Client connection object.
   * @param room            Room name.
   * @param callback        Callback.
   */
  removeMember (connectionId, room, callback) {
    let self = this

    // if the connection does not exists on the connections array perform a remove
    // member on the cluster
    if (self.api.connections.connections[ connectionId ] === undefined) {
      self.api.redis.doCluster('api.chatRoom.removeMember', [ connectionId, room ], connectionId, callback)
      return
    }

    let connection = self.api.connections.connections[ connectionId ]

    // check if the client is connected with the room
    if (connection.rooms.indexOf(room) < 0) {
      if (typeof callback === 'function') { callback(self.api.config.errors.connectionNotInRoom(connection, room), false) }
      return
    }

    // check if the room exists
    self.exists(room, (error, found) => {
      // if the room has not been found returned an error
      if (found === false) {
        if (typeof callback === 'function') { callback(self.api.config.errors.connectionRoomNotExist(room), false) }
        return
      }

      // passes the response by the middleware
      self._handleCallbacks(connection, room, 'leave', null, error => {
        // execute the callback and return the error
        if (error) { return callback(error, false) }

        // remove the user
        self.api.redis.client.hdel(self.keys.members + room, connection.id, () => {
          // get the room index
          let index = connection.rooms.indexOf(room)

          // remove room from the rooms array
          if (index > -1) { connection.rooms.splice(index, 1) }

          // execute the callback
          if (typeof callback === 'function') { callback(null, true) }
        })
      })
    })
  }

  // --------------------------------------------------------------------------------------------------------- [Private]

  /**
   * Generate a new object with member details.
   *
   * @param connection  Connection object.
   * @returns {{id: *, joinedAt: number, host: *}}
   * @private
   */
  _generateMemberDetails (connection) {
    let self = this;

    return {
      id: connection.id,
      joinedAt: new Date().getTime(),
      host: self.api.id
    };
  }

  /**
   * Generate a new message payload.
   *
   * @param message   Base message.
   * @returns {{message: *, room: *, from: *, context: string, sendAt: *}}
   * @private
   */
  _generateMessagePayload (message) {
    return {
      message: message.message,
      room: message.connection.room,
      from: message.connection.id,
      context: 'user',
      sendAt: message.sendAt
    }
  }

  /**
   * Handle the redis callbacks.
   *
   * This apply all global middleware for each callback response.
   *
   * @param connection        Connection object.
   * @param room              Room name.
   * @param direction         Message direction.
   * @param messagePayload    Message payload.
   * @param callback          Callback function.
   * @private
   */
  _handleCallbacks (connection, room, direction, messagePayload, callback) {
    let self = this
    let jobs = []
    let newMessagePayload

    // if the message payload are defined create a clone
    if (messagePayload) { newMessagePayload = Utils.objClone(messagePayload) }

    // apply global middleware
    self.globalMiddleware.forEach(name => {
      // get middleware object
      let m = self.middleware[ name ]

      // the middleware should be a function
      if (typeof  m[ direction ] !== 'function') { return }

      // push a new job to the queue
      jobs.push(callback => {
        if (messagePayload) {
          m[ direction ](connection, room, newMessagePayload, (error, data) => {
            if (data) { newMessagePayload = data }
            callback(error, data)
          })
          return
        }

        // execute the middleware without the payload
        m[ direction ](connection, room, callback)
      })
    })

    // execute all middleware
    async.series(jobs, (error, data) => {
      while (data.length > 0) {
        let thisData = data.shift()

        // change the new message object to the next middleware use it
        if (thisData) { newMessagePayload = thisData }
      }

      // execute the next middleware
      callback(error, newMessagePayload)
    })
  }

  /**
   * Sanitize member details.
   *
   * @param memberData                  Member details to be sanitized.
   * @returns {{id: *, joinedAt: *}}    Sanitized
   * @private
   */
  _sanitizeMemberDetails (memberData) {
    return {
      id: memberData.id,
      joinedAt: memberData.joinedAt
    };
  }

  /**
   * Process a incoming connection for a connection object.
   *
   * @param connection      Connection object.
   * @param messagePayload  Message payload to be sent.
   * @private
   */
  _incomingMessagePerConnection (connection, messagePayload) {
    let self = this

    // check if the connection can chat
    if (connection.canChat !== true) { return }

    // check if the connection made part of the room
    if (connection.rooms.indexOf(messagePayload.room) < 0) { return }

    // apply the middleware
    self._handleCallbacks(connection, messagePayload.room, 'say', messagePayload, (err, newMessagePayload) => {
      if (!err) {
        connection.sendMessage(newMessagePayload, 'say')
      }
    })
  }
}

/**
 * Initializer.
 */
export default class {

  /**
   * Initializer load priority.
   *
   * @type {number}
   */
  loadPriority = 520

  /**
   * Initializer start priority.
   *
   * @type {number}
   */
  startPriority = 200

  /**
   * Initializer loading function.
   *
   * @param api   API reference.
   * @param next  Callback.
   */
  load (api, next) {
    // put the chat room interface available to all system
    api.chatRoom = new ChatRooms(api)

    // end the initializer loading
    next()
  }

  /**
   * Initializer starting function.
   *
   * @param api   API reference.
   * @param next  Callback.
   */
  start (api, next) {
    // subscribe new chat messages on the redis server
    api.redis.subscriptionHandlers.chat = message => { api.chatRoom.incomingMessage(message) }

    // check if we need to create some starting chat rooms
    if (api.config.general.startingChatRooms) {
      for (let room in api.config.general.startingChatRooms) {
        api.log(`ensuring the existence of the chatRoom: ${room}`)
        api.chatRoom.add(room)
      }
    }

    // end the initializer starting
    next()
  }

}
