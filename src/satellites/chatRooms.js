import async from "async";

class ChatRooms {
  /**
   * API reference.
   *
   * @type {null}
   */
  api = null;

  /**
   * Keys to use to save rooms and members on redis server.
   *
   * @type {{rooms: string, members: string}}
   */
  keys = {
    rooms: "stellar:chatRoom:rooms",
    members: "stellar:chatRoom:members",
  };

  /**
   * List of globals middleware.
   *
   * @type {Array}
   */
  globalMiddleware = [];

  /**
   * List of all middleware.
   *
   * @type {{}}
   */
  middleware = {};

  /**
   * Constructor.
   *
   * @param api API reference.
   */
  constructor(api) {
    this.api = api;
  }

  /**
   * Add a new middleware to the chat room manager.
   *
   * @param data  Middleware object.
   */
  addMiddleware(data) {
    // middleware must have a name
    if (!data.name) {
      throw new Error("middleware.name is required");
    }

    // if the middleware don't have a priority set a default value
    if (!data.priority) {
      data.priority = this.api.config.general.defaultMiddlewarePriority;
    }

    // ensure the priority is a number
    data.priority = Number(data.priority);

    // save the middleware object
    this.middleware[data.name] = data;

    // push the middleware name to the globalMiddleware
    this.globalMiddleware.push(data.name);

    // sort the globalMiddleware by priority
    this.globalMiddleware.sort((a, b) => (this.middleware[a].priority > this.middleware[b].priority ? 1 : -1));
  }

  /**
   * This allow send an event to a chat room.
   *
   * @param room        Room here the message must be sent.
   * @param event       Event to sent.
   * @param data        Data to be sent.
   * @param connection  Connection that originated the event, by default is used an empty connection.
   * @returns {*}
   */
  emit(room, event, data, connection = {}) {
    return this.broadcast(connection, room, { event, data });
  }

  /**
   * Broadcast a message in a room.
   *
   * @param connection  Source connection.
   * @param room        Room here the message need to be broadcast.
   * @param message     Message to broadcast.
   */
  async broadcast(connection, room, message) {
    // we need the room name and the message to send
    if (!room || room.length === 0 || message === null || message.length === 0) {
      throw this.api.config.errors.connectionRoomAndMessage(connection);
    }

    if (connection.rooms === undefined || connection.rooms.indexOf(room) > -1) {
      // set id zero for default if there no one present
      if (connection.id === undefined) {
        connection.id = 0;
      }

      // create a new payload
      let payload = {
        messageType: "chat",
        serverToken: this.api.config.general.serverToken,
        serverId: this.api.id,
        message,
        sentAt: new Date().getTime(),
        connection: {
          id: connection.id,
          room: room,
        },
      };

      // generate the message payload
      let messagePayload = this._generateMessagePayload(payload);

      // handle callbacks
      const newPayload = await this._handleCallbacks(connection, messagePayload.room, "onSayReceive", messagePayload);

      // create the payload to send
      let payloadToSend = {
        messageType: "chat",
        serverToken: this.api.config.general.serverToken,
        serverId: this.api.id,
        message: newPayload.message,
        sentAt: newPayload.sentAt,
        connection: {
          id: newPayload.from,
          room: newPayload.room,
        },
      };

      // send the payload to redis
      this.api.redis.publish(payloadToSend);
      return;
    }

    // when the connection isn't on the room, throw an exception
    throw this.api.config.errors.connectionNotInRoom(connection, room);
  }

  /**
   * Process an incoming message.
   *
   * @param message Incoming message to be processed.
   */
  incomingMessage(message) {
    // generate the message payload
    let messagePayload = this._generateMessagePayload(message);

    // iterate all connection
    for (let i in this.api.connections.connections) {
      this._incomingMessagePerConnection(this.api.connections.connections[i], messagePayload);
    }
  }

  /**
   * Get a list of rooms.
   */
  list() {
    return this.api.redis.clients.client.smembers(this.keys.rooms);
  }

  /**
   * Create a new room.
   *
   * @param room  Name of the room to be created.
   */
  async create(room) {
    // check if the room already exists
    const found = await this.exists(room);

    // if the room already exists throw an error
    if (found === true) {
      throw this.api.config.errors.connectionRoomExists(room);
    }

    // create a new room
    return this.api.redis.clients.client.sadd(this.keys.rooms, room);
  }

  /**
   * Destroy a room.
   *
   * @param room  Room to be destroyed.
   */
  async destroy(room) {
    // check if the room exists
    const found = await this.exists(room);

    // throw an error if th room not exists
    if (found === false) {
      throw this.api.config.errors.connectionRoomNotExist(room);
    }

    // emit destroy event to the room
    await this.emit(room, "destroy", this.api.config.errors.connectionRoomHasBeenDeleted(room));

    // get all room members
    const members = await this.api.redis.clients.client.hgetall(this.keys.members + room);

    // remove each member from the room
    for (let id in members) {
      await this.leave(id, room);
    }

    // delete de room on redis server
    return this.api.redis.clients.client.srem(this.keys.rooms, room);
  }

  /**
   * Check if the given room exists.
   *
   * @param room      Name of the room.
   */
  async exists(room) {
    // make a call to the redis server to check if the room exists
    const bool = await this.api.redis.clients.client.sismember(this.keys.rooms, room);
    return bool === 1 || bool === true;
  }

  /**
   * Get the status of a room.
   *
   * @param room  Name of the room to check.
   */
  async status(room) {
    // we need a room to check their status
    if (room === undefined || room === null) {
      throw this.api.config.errors.connectionRoomRequired();
    }

    // check if the room exists
    const found = await this.exists(room);

    if (!found) {
      throw this.api.config.errors.connectionRoomNotExist(room);
    }

    // generate the key
    const key = this.keys.members + room;

    // get all room members
    const members = await this.api.redis.clients.client.hgetall(key);

    let cleanedMembers = {};
    let count = 0;

    // iterate all members and add them to the list of members
    for (let id in members) {
      const data = JSON.parse(members[id]);
      cleanedMembers[id] = this._sanitizeMemberDetails(data);
      count++;
    }

    return {
      room,
      members: cleanedMembers,
      membersCount: count,
    };
  }

  /**
   * Add a new member to a room.
   *
   * @param connectionId  Connection ID.
   * @param room          Room name where the client must be added.
   */
  async join(connectionId, room) {
    // if the connection not exists create a new one in every stellar instance and return
    if (!this.api.connections.connections[connectionId]) {
      return this.api.redis.doCluster("api.chatRoom.addMember", [connectionId, room], connectionId);
    }

    // get connection object
    let connection = this.api.connections.connections[connectionId];

    // verifies that the connection is already within the room, if yes return now
    if (connection.rooms.indexOf(room) > -1) {
      throw this.api.config.errors.connectionAlreadyInRoom(connection, room);
    }

    // check if the room exists
    const found = await this.exists(room);

    if (!found) {
      throw this.api.config.errors.connectionRoomNotExist(room);
    }

    // wait for callback
    await this._handleCallbacks(connection, room, "join", null);

    // generate the member details
    let memberDetails = this._generateMemberDetails(connection);

    // add member to the room
    await this.api.redis.clients.client.hset(this.keys.members + room, connection.id, JSON.stringify(memberDetails));

    // push the new room to the connection object
    connection.rooms.push(room);

    return true;
  }

  /**
   * Remove a client from a chat room.
   *
   * @param connectionId    Client connection object.
   * @param room            Room name.
   */
  async leave(connectionId, room) {
    // if the connection does not exists on the connections array perform a remove
    // member on the cluster
    if (this.api.connections.connections[connectionId] === undefined) {
      return this.api.redis.doCluster("api.chatRoom.leave", [connectionId, room], connectionId);
    }

    // get connection
    const connection = this.api.connections.connections[connectionId];

    // check if the client is connected with the room
    if (connection.rooms.indexOf(room) < 0) {
      throw this.api.config.errors.connectionNotInRoom(connection, room);
    }

    // check if the room exists
    const found = await this.exists(room);

    // if the room has not been found returned an error
    if (!found) {
      throw this.api.config.errors.connectionRoomNotExist(room);
    }

    // passes the response by the middleware
    await this._handleCallbacks(connection, room, "leave", null);

    // remove the user
    await this.api.redis.clients.client.hdel(this.keys.members + room, connection.id);

    // get the room index
    let index = connection.rooms.indexOf(room);

    // remove room from the rooms array
    if (index > -1) {
      connection.rooms.splice(index, 1);
    }

    return true;
  }

  // --------------------------------------------------------------------------------------------------------- [Private]

  /**
   * Generate a new object with member details.
   *
   * @param connection  Connection object.
   * @returns {{id: *, joinedAt: number, host: *}}
   * @private
   */
  _generateMemberDetails(connection) {
    return {
      id: connection.id,
      joinedAt: new Date().getTime(),
      host: this.api.id,
    };
  }

  /**
   * Generate a new message payload.
   *
   * @param message   Base message.
   * @returns {{message: *, room: *, from: *, context: string, sendAt: *}}
   * @private
   */
  _generateMessagePayload(message) {
    return {
      message: message.message,
      room: message.connection.room,
      from: message.connection.id,
      context: "user",
      sentAt: message.sentAt,
    };
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
   * @private
   */
  _handleCallbacks(connection, room, direction, messagePayload) {
    const jobs = [];
    let newMessagePayload;

    // if the message payload are defined create a clone
    if (messagePayload) {
      newMessagePayload = this.api.utils.objClone(messagePayload);
    }

    // apply global middleware
    this.globalMiddleware.forEach((name) => {
      // get middleware object
      let m = this.middleware[name];

      // the middleware should be a function
      if (typeof m[direction] !== "function") {
        return;
      }

      // push a new job to the queue
      jobs.push((callback) => {
        if (messagePayload) {
          m[direction](connection, room, newMessagePayload, (error, data) => {
            if (data) {
              newMessagePayload = data;
            }
            callback(error, data);
          });
          return;
        }

        // execute the middleware without the payload
        m[direction](connection, room, callback);
      });
    });

    return new Promise((resolve, reject) => {
      // execute all middleware
      async.series(jobs, (error, data) => {
        while (data.length > 0) {
          let thisData = data.shift();

          // change the new message object to the next middleware use it
          if (thisData) {
            newMessagePayload = thisData;
          }
        }

        // execute the next middleware
        if (error) {
          return reject(error);
        }

        // resolve the promise
        resolve(newMessagePayload);
      });
    });
  }

  /**
   * Sanitize member details.
   *
   * @param memberData                  Member details to be sanitized.
   * @returns {{id: *, joinedAt: *}}    Sanitized
   * @private
   */
  _sanitizeMemberDetails(memberData) {
    return {
      id: memberData.id,
      joinedAt: memberData.joinedAt,
    };
  }

  /**
   * Process a incoming connection for a connection object.
   *
   * @param connection      Connection object.
   * @param messagePayload  Message payload to be sent.
   * @private
   */
  async _incomingMessagePerConnection(connection, messagePayload) {
    // check if the connection can chat
    if (connection.canChat !== true) {
      return;
    }

    // check if the connection made part of the room
    if (connection.rooms.indexOf(messagePayload.room) < 0) {
      return;
    }

    try {
      // apply the middleware
      const newMessagePayload = await this._handleCallbacks(connection, messagePayload.room, "say", messagePayload);

      // send a message to the connection
      connection.sendMessage(newMessagePayload, "say");
    } catch (e) {
      // TODO should we do anything here?
    }
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
  loadPriority = 520;

  /**
   * Initializer start priority.
   *
   * @type {number}
   */
  startPriority = 200;

  /**
   * Initializer loading function.
   *
   * @param api   API reference.
   * @param next  Callback.
   */
  load(api, next) {
    // put the chat room interface available to all system
    api.chatRoom = new ChatRooms(api);

    // end the initializer loading
    next();
  }

  /**
   * Initializer starting function.
   *
   * @param api   API reference.
   * @param next  Callback.
   */
  start(api, next) {
    let work = Promise.resolve();

    // subscribe new chat messages on the redis server
    api.redis.subscriptionHandlers["chat"] = (message) => {
      api.chatRoom.incomingMessage(message);
    };

    // check if we need to create some starting chat rooms
    if (api.config.general.startingChatRooms) {
      for (let room in api.config.general.startingChatRooms) {
        api.log(`ensuring the existence of the chatRoom: ${room}`);
        work.then((_) => api.chatRoom.create(room)).catch((_) => {});
      }
    }

    // end the initializer starting
    work.then((_) => {
      next();
    });
  }
}
