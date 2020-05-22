"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const UUID = require("uuid");
class Connection {
  constructor(api, data) {
    this.rooms = [];
    this.error = null;
    this.params = {};
    this.fingerprint = null;
    this.pendingActions = 0;
    this.totalActions = 0;
    this.messageCount = 0;
    this.canChat = false;
    this.type = null;
    this.remotePort = null;
    this.remoteIP = null;
    this.rawConnection = null;
    this.destroyed = false;
    this.api = api;
    this.setup(data);
    this.api.connections.connections[this.id] = this;
    this.api.connections.globalMiddleware.forEach(middlewareName => {
      if (typeof this.api.connections.middleware[middlewareName].create ===
                "function") {
        this.api.connections.middleware[middlewareName].create(this);
      }
    });
  }
  setup(data) {
    if (data.id) {
      this.id = data.id;
    }
    else {
      this.id = UUID.v4();
    }
    this.connectedAt = new Date().getTime();
    const requiredFields = ["type", "rawConnection"];
    requiredFields.forEach(req => {
      if (data[req] === null || data[req] === undefined) {
        throw new Error(`${req} is required to create a new connection object`);
      }
      this[req] = data[req];
    });
    const enforcedConnectionProperties = ["remotePort", "remoteIP"];
    enforcedConnectionProperties.forEach(req => {
      if (data[req] === null || data[req] === undefined) {
        if (this.api.configs.general.enforceConnectionProperties === true) {
          throw new Error(`${req} is required to create a new connection object`);
        }
        else {
          data[req] = 0;
        }
      }
      this[req] = data[req];
    });
    this.api.i18n.invokeConnectionLocale(this);
  }
  sendMessage(message) {
    throw new Error(`I should be replaced with a connection-specific method [${message}]`);
  }
  sendFile(path) {
    throw new Error(`I should be replaced with a connection-specific method [${path}]`);
  }
  localize(message) {
    return this.api.i18n.localize(message, this);
  }
  destroy() {
    this.destroyed = true;
    this.api.connections.globalMiddleware.forEach(middlewareName => {
      if (typeof this.api.connections.middleware[middlewareName].destroy ===
                "function") {
        this.api.connections.middleware[middlewareName].destroy(this);
      }
    });
    if (this.canChat === true) {
      this.rooms.forEach(room => this.api.chatRoom.leave(this.id, room));
    }
    const server = this.api.servers.servers[this.type];
    if (server) {
      if (server.attributes.logExits === true) {
        server.log("connection closed", "info", {
          to: this.remoteIP,
        });
      }
      if (typeof server.goodbye === "function") {
        server.goodbye(this);
      }
    }
    delete this.api.connections.connections[this.id];
  }
  set(key, value) {
    this[key] = value;
    return this;
  }
  async verbs(verb, words = []) {
    const server = this.api.servers.servers.get(this.type);
    let key;
    let value;
    let room;
    const allowedVerbs = server.attributes.verbs;
    if (!Array.isArray(words)) {
      words = [words];
    }
    if (server && allowedVerbs.indexOf(verb) >= 0) {
      server.log("verb", "debug", {
        verb,
        to: this.remoteIP,
        params: JSON.stringify(words),
      });
      if (verb === "quit" || verb === "exit") {
        server.goodbye(this);
      }
      else if (verb === "paramAdd") {
        key = words[0];
        value = words[1];
        if (words[0] && words[0].indexOf("=") >= 0) {
          const parts = words[0].split("=");
          key = parts[0];
          value = parts[1];
        }
        this.params[key] = value;
        return null;
      }
      else if (verb === "paramDelete") {
        key = words[0];
        delete this.params[key];
        return null;
      }
      else if (verb === "paramView") {
        key = words[0];
        return this.params[key];
      }
      else if (verb === "paramsView") {
        return this.params;
      }
      else if (verb === "paramsDelete") {
        this.params = {};
        return null;
      }
      else if (verb === "roomJoin") {
        room = words[0];
        return this.api.chatRoom.join(this.id, room);
      }
      else if (verb === "roomLeave") {
        room = words[0];
        return this.api.chatRoom.leave(this.id, room);
      }
      else if (verb === "roomView") {
        room = words[0];
        if (this.rooms.indexOf(room) > -1) {
          return this.api.chatRoom.status(room);
        }
        else {
          throw new Error(`Not member of room "${room}"`);
        }
      }
      else if (verb === "detailsView") {
        return {
          id: this.id,
          fingerprint: this.fingerprint,
          remoteIP: this.remoteIP,
          remotePort: this.remotePort,
          params: this.params,
          connectedAt: this.connectedAt,
          rooms: this.rooms,
          totalActions: this.totalActions,
          pendingActions: this.pendingActions,
        };
      }
      else if (verb === "say") {
        room = words.shift();
        return this.api.chatRoom.broadcast(this, room, words.join(" "));
      }
      else if (verb === "event") {
        const { room, event, data } = words.shift();
        this.api.events.fire(`event.${event}`, { room, data });
        this.api.events.fire(`event.${room}.${event}`, { room, data });
        return this.api.chatRoom.broadcast(this, room, { event, data });
      }
      else {
        throw new Error(this.api.configs.errors.verbNotFound(this, verb));
      }
    }
    else {
      throw new Error(this.api.configs.errors.verbNotAllowed(this, verb));
    }
  }
}
exports.Connection = Connection;
//# sourceMappingURL=connection.js.map