'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _async = require('async');

var _async2 = _interopRequireDefault(_async);

var _utils = require('../utils');

var _utils2 = _interopRequireDefault(_utils);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var ChatRooms = function () {

  /**
   * Constructor.
   *
   * @param api API reference.
   */


  /**
   * List of globals middleware.
   *
   * @type {Array}
   */


  /**
   * API reference.
   *
   * @type {null}
   */

  function ChatRooms(api) {
    _classCallCheck(this, ChatRooms);

    this.api = null;
    this.keys = {
      rooms: 'stellar:chatRoom:rooms',
      members: 'stellar:chatRoom:members'
    };
    this.globalMiddleware = [];
    this.middleware = {};
    this.api = api;
  }

  /**
   * Add a new middleware to the chat room manager.
   *
   * @param data  Middleware object.
   */


  /**
   * List of all middleware.
   *
   * @type {{}}
   */


  /**
   * Keys to use to save rooms and members on redis server.
   *
   * @type {{rooms: string, members: string}}
   */


  _createClass(ChatRooms, [{
    key: 'addMiddleware',
    value: function addMiddleware(data) {
      var self = this;

      // middleware must have a name
      if (!data.name) {
        throw new Error('middleware.name is required');
      }

      // if the middleware don't have a priority set a default value
      if (!data.priority) {
        data.priority = self.api.config.general.defaultMiddlewarePriority;
      }

      // ensure the priority is a number
      data.priority = Number(data.priority);

      // save the middleware object
      self.middleware[data.name] = data;

      // push the middleware name to the globalMiddleware
      self.globalMiddleware.push(data.name);

      // sort the globalMiddleware by priority
      self.globalMiddleware.sort(function (a, b) {
        if (self.middleware[a].priority > self.middleware[b].priority) {
          return 1;
        } else {
          return -1;
        }
      });
    }

    /**
     * Broadcast a message in a room.
     *
     * @param connection  Source connection.
     * @param room        Room here the message need to be broadcast.
     * @param message     Message to broadcast.
     * @param callback    Callback function.
     */

  }, {
    key: 'broadcast',
    value: function broadcast(connection, room, message, callback) {
      var self = this;

      // check if the room are present
      if (!room || room.length === 0 || message === null || message.length === 0) {
        if (typeof callback === 'function') {
          process.nextTick(function () {
            return callback(self.api.config.errors.connectionRoomAndMessage(connection));
          });
        }
      } else if (connection.rooms === undefined || connection.rooms.indexOf(room) > -1) {
        // set id zero for default if there no one present
        if (connection.id === undefined) {
          connection.id = 0;
        }

        // create a new payload
        var payload = {
          messageType: 'chat',
          serverToken: self.api.config.general.serverToken,
          serverId: self.api.id,
          message: message,
          sentAt: new Date().getTime(),
          connection: {
            id: connection.id,
            room: room
          }
        };

        // generate the message payload
        var messagePayload = self._generateMessagePayload(payload);

        // handle callbacks
        self._handleCallbacks(connection, messagePayload.room, 'onSayReceive', messagePayload, function (error, newPayload) {
          // if an error occurs execute the callback and send the error with him
          if (error) {
            if (typeof callback === 'function') {
              process.nextTick(function () {
                callback(error);
              });
            }
            return;
          }

          // create the payload to send
          var payloadToSend = {
            messageType: 'chat',
            serverToken: self.api.config.general.serverToken,
            serverId: self.api.id,
            message: newPayload.message,
            sentAt: newPayload.sentAt,
            connection: {
              id: newPayload.from,
              room: newPayload.room
            }
          };

          // send the payload to redis
          self.api.redis.publish(payloadToSend);

          // execute the callback
          if (typeof callback === 'function') {
            process.nextTick(function () {
              callback(null);
            });
          }
        });
      } else {
        if (typeof callback === 'function') {
          process.nextTick(function () {
            callback(self.api.config.errors.connectionNotInRoom(connection, room));
          });
        }
      }
    }

    /**
     * Process an incoming message.
     *
     * @param message Incoming message to be processed.
     */

  }, {
    key: 'incomingMessage',
    value: function incomingMessage(message) {
      var self = this;

      // generate the message payload
      var messagePayload = self._generateMessagePayload(message);

      // iterate all connection
      for (var i in self.api.connections.connections) {
        self._incomingMessagePerConnection(self.api.connections.connections[i], messagePayload);
      }
    }

    /**
     * List rooms.
     *
     * @param callback
     */

  }, {
    key: 'list',
    value: function list(callback) {
      var self = this;

      self.api.redis.clients.client.smembers(self.api.chatRoom.keys.rooms, function (error, rooms) {
        if (typeof callback === 'function') {
          callback(error, rooms);
        }
      });
    }

    /**
     * Create a new room.
     *
     * @param room      Name of the room to be created.
     * @param callback  Callback function.
     */

  }, {
    key: 'add',
    value: function add(room, callback) {
      var self = this;

      // check if the room already exists
      self.exists(room, function (err, found) {
        // if the room already exists return an error
        if (found === true) {
          if (typeof callback === 'function') {
            callback(self.api.config.errors.connectionRoomExists(room), null);
          }
          return;
        }

        // create a new room
        self.api.redis.clients.client.sadd(self.keys.rooms, room, function (err, count) {
          if (typeof callback === 'function') {
            callback(err, count);
          }
        });
      });
    }

    /**
     * Destroy a room.
     *
     * @param room      Room to be destroyed.
     * @param callback  Callback function.
     */

  }, {
    key: 'destroy',
    value: function destroy(room, callback) {
      var self = this;

      // check if the room exists
      self.exists(room, function (error, found) {
        // return an error if the room not exists
        if (found === false) {
          if (typeof callback === 'function') {
            callback(self.api.config.errors.connectionRoomNotExist(room), null);
          }
          return;
        }

        // broadcast the room destruction
        self.broadcast({}, room, self.api.config.errors.connectionRoomHasBeenDeleted(room), function () {
          // get all room members
          self.api.redis.clients.client.hgetall(self.keys.members + room, function (error, memberHash) {
            // remove each member from the room
            for (var id in memberHash) {
              self.removeMember(id, room);
            }

            // delete de room on redis server
            self.api.redis.clients.client.srem(self.keys.rooms, room, function () {
              if (typeof callback === 'function') {
                callback();
              }
            });
          });
        });
      });
    }

    /**
     * Check if the given room exists.
     *
     * @param room      Name of the room.
     * @param callback  Callback function.
     */

  }, {
    key: 'exists',
    value: function exists(room, callback) {
      var self = this;

      // make a call to the redis server to check if the room exists
      self.api.redis.clients.client.sismember(self.keys.rooms, room, function (err, bool) {
        var found = false;

        if (bool === 1 || bool === true) {
          found = true;
        }

        // execute the callback
        if (typeof callback === 'function') {
          callback(err, found);
        }
      });
    }

    /**
     * Get the status of a room.
     *
     * @param room      Name of the room to check.
     * @param callback  Callback function.
     */

  }, {
    key: 'roomStatus',
    value: function roomStatus(room, callback) {
      var self = this;

      // we need a room to check their status
      if (room === undefined || room === null) {
        if (typeof callback === 'function') {
          callback(self.api.config.errors.connectionRoomRequired(), null);
        }
        return;
      }

      // check if the room exists
      self.exists(room, function (err, found) {
        // the room need exists
        if (found !== true) {
          if (typeof callback === 'function') {
            callback(self.api.config.errors.connectionRoomNotExist(room), null);
          }
          return;
        }

        // generate the key
        var key = self.keys.members + room;

        // get all channel members
        self.api.redis.clients.client.hgetall(key, function (error, members) {
          var cleanedMembers = {};
          var count = 0;

          // iterate all members and add them to the list of members
          for (var id in members) {
            var data = JSON.parse(members[id]);
            cleanedMembers[id] = self._sanitizeMemberDetails(data);
            count++;
          }

          // execute the callback
          callback(null, {
            room: room,
            members: cleanedMembers,
            membersCount: count
          });
        });
      });
    }

    /**
     * Add a new member to a room.
     *
     * @param connectionId  Connection ID.
     * @param room          Room name where the client must be added.
     * @param callback      Callback function.
     */

  }, {
    key: 'addMember',
    value: function addMember(connectionId, room, callback) {
      var self = this;

      // if the connection not exists create a new one in every stellar instance and return
      if (!self.api.connections.connections[connectionId]) {
        self.api.redis.doCluster('api.chatRoom.addMember', [connectionId, room], connectionId, callback);
        return;
      }

      // get connection object
      var connection = self.api.connections.connections[connectionId];

      // verifies that the connection is already within the room, if yes return now
      if (connection.rooms.indexOf(room) > -1) {
        if (typeof callback === 'function') {
          callback(self.api.config.errors.connectionAlreadyInRoom(connection, room), false);
        }
        return;
      }

      // check if the room exists
      self.exists(room, function (error, found) {
        if (found !== true) {
          if (typeof callback === 'function') {
            callback(self.api.config.errors.connectionRoomNotExist(room), false);
          }
          return;
        }

        self._handleCallbacks(connection, room, 'join', null, function (error) {
          // if exists an error, execute the callback and return
          if (error) {
            return callback(error, false);
          }

          // generate the member details
          var memberDetails = self._generateMemberDetails(connection);

          self.api.redis.clients.client.hset(self.keys.members + room, connection.id, JSON.stringify(memberDetails), function () {
            connection.rooms.push(room);
            if (typeof callback === 'function') {
              callback(null, true);
            }
          });
        });
      });
    }

    /**
     * Remove a client from a chat room.
     *
     * @param connectionId    Client connection object.
     * @param room            Room name.
     * @param callback        Callback.
     */

  }, {
    key: 'removeMember',
    value: function removeMember(connectionId, room, callback) {
      var self = this;

      // if the connection does not exists on the connections array perform a remove
      // member on the cluster
      if (self.api.connections.connections[connectionId] === undefined) {
        self.api.redis.doCluster('api.chatRoom.removeMember', [connectionId, room], connectionId, callback);
        return;
      }

      var connection = self.api.connections.connections[connectionId];

      // check if the client is connected with the room
      if (connection.rooms.indexOf(room) < 0) {
        if (typeof callback === 'function') {
          callback(self.api.config.errors.connectionNotInRoom(connection, room), false);
        }
        return;
      }

      // check if the room exists
      self.exists(room, function (error, found) {
        // if the room has not been found returned an error
        if (found === false) {
          if (typeof callback === 'function') {
            callback(self.api.config.errors.connectionRoomNotExist(room), false);
          }
          return;
        }

        // passes the response by the middleware
        self._handleCallbacks(connection, room, 'leave', null, function (error) {
          // execute the callback and return the error
          if (error) {
            return callback(error, false);
          }

          // remove the user
          self.api.redis.clients.client.hdel(self.keys.members + room, connection.id, function () {
            // get the room index
            var index = connection.rooms.indexOf(room);

            // remove room from the rooms array
            if (index > -1) {
              connection.rooms.splice(index, 1);
            }

            // execute the callback
            if (typeof callback === 'function') {
              callback(null, true);
            }
          });
        });
      });
    }

    // --------------------------------------------------------------------------------------------------------- [Private]

    /**
     * Generate a new object with member details.
     *
     * @param connection  Connection object.
     * @returns {{id: *, joinedAt: number, host: *}}
     * @private
     */

  }, {
    key: '_generateMemberDetails',
    value: function _generateMemberDetails(connection) {
      var self = this;

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

  }, {
    key: '_generateMessagePayload',
    value: function _generateMessagePayload(message) {
      return {
        message: message.message,
        room: message.connection.room,
        from: message.connection.id,
        context: 'user',
        sentAt: message.sentAt
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
     * @param callback          Callback function.
     * @private
     */

  }, {
    key: '_handleCallbacks',
    value: function _handleCallbacks(connection, room, direction, messagePayload, callback) {
      var self = this;

      var jobs = [];
      var newMessagePayload = void 0;

      // if the message payload are defined create a clone
      if (messagePayload) {
        newMessagePayload = _utils2.default.objClone(messagePayload);
      }

      // apply global middleware
      self.globalMiddleware.forEach(function (name) {
        // get middleware object
        var m = self.middleware[name];

        // the middleware should be a function
        if (typeof m[direction] !== 'function') {
          return;
        }

        // push a new job to the queue
        jobs.push(function (callback) {
          if (messagePayload) {
            m[direction](connection, room, newMessagePayload, function (error, data) {
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

      // execute all middleware
      _async2.default.series(jobs, function (error, data) {
        while (data.length > 0) {
          var thisData = data.shift();

          // change the new message object to the next middleware use it
          if (thisData) {
            newMessagePayload = thisData;
          }
        }

        // execute the next middleware
        callback(error, newMessagePayload);
      });
    }

    /**
     * Sanitize member details.
     *
     * @param memberData                  Member details to be sanitized.
     * @returns {{id: *, joinedAt: *}}    Sanitized
     * @private
     */

  }, {
    key: '_sanitizeMemberDetails',
    value: function _sanitizeMemberDetails(memberData) {
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

  }, {
    key: '_incomingMessagePerConnection',
    value: function _incomingMessagePerConnection(connection, messagePayload) {
      var self = this;

      // check if the connection can chat
      if (connection.canChat !== true) {
        return;
      }

      // check if the connection made part of the room
      if (connection.rooms.indexOf(messagePayload.room) < 0) {
        return;
      }

      // apply the middleware
      self._handleCallbacks(connection, messagePayload.room, 'say', messagePayload, function (err, newMessagePayload) {
        if (!err) {
          connection.sendMessage(newMessagePayload, 'say');
        }
      });
    }
  }]);

  return ChatRooms;
}();

/**
 * Initializer.
 */


var _class = function () {
  function _class() {
    _classCallCheck(this, _class);

    this.loadPriority = 520;
    this.startPriority = 200;
  }

  /**
   * Initializer load priority.
   *
   * @type {number}
   */


  /**
   * Initializer start priority.
   *
   * @type {number}
   */


  _createClass(_class, [{
    key: 'load',


    /**
     * Initializer loading function.
     *
     * @param api   API reference.
     * @param next  Callback.
     */
    value: function load(api, next) {
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

  }, {
    key: 'start',
    value: function start(api, next) {
      // subscribe new chat messages on the redis server
      api.redis.subscriptionHandlers['chat'] = function (message) {
        api.chatRoom.incomingMessage(message);
      };

      // check if we need to create some starting chat rooms
      if (api.config.general.startingChatRooms) {
        for (var room in api.config.general.startingChatRooms) {
          api.log('ensuring the existence of the chatRoom: ' + room);
          api.chatRoom.add(room);
        }
      }

      // end the initializer starting
      next();
    }
  }]);

  return _class;
}();

exports.default = _class;
//# sourceMappingURL=chatRooms.js.map
