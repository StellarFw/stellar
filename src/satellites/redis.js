import async from "async";
import { randomUUID } from "crypto";

/**
 * Redis manager class.
 *
 * This creates a interface to connect with a redis server.
 */
class RedisManager {
  /**
   * API reference.
   *
   * @type {null}
   */
  api = null;

  /**
   * Hash with all instantiate clients.
   *
   * @type {{}}
   */
  clients = {};

  /**
   * Callbacks.
   *
   * @type {{}}
   */
  clusterCallbacks = {};

  /**
   * Cluster callback timeouts.
   *
   * @type {{}}
   */
  clusterCallbackTimeouts = {};

  /**
   * Subscription handlers.
   *
   * @type {{}}
   */
  subscriptionHandlers = {};

  /**
   * Redis manager status.
   *
   * @type {{subscribed: boolean}}
   */
  status = {
    subscribed: false,
  };

  /**
   * Constructor.
   *
   * @param api API reference.
   */
  constructor(api) {
    // save api reference object
    this.api = api;

    // subscription handlers

    this.subscriptionHandlers["do"] = (message) => {
      if (!message.connectionId || this.api.connections.connections[message.connectionId]) {
        let cmdParts = message.method.split(".");
        let cmd = cmdParts.shift();
        if (cmd !== "api") {
          throw new Error("cannot operate on a outside of the api object");
        }
        let method = this.api.utils.stringToHash(api, cmdParts.join("."));

        let callback = () => {
          let responseArgs = Array.apply(null, arguments).sort();
          process.nextTick(() => {
            this.respondCluster(message.requestId, responseArgs);
          });
        };

        let args = message.args;
        if (args === null) {
          args = [];
        }
        if (!Array.isArray(args)) {
          args = [args];
        }
        args.push(callback);
        if (method) {
          method.apply(null, args);
        } else {
          this.api.log(`RP method '${cmdParts.join(".")}' not found`, "warning");
        }
      }
    };

    this.subscriptionHandlers["doResponse"] = (message) => {
      if (this.clusterCallbacks[message.requestId]) {
        clearTimeout(this.clusterCallbackTimeouts[message.requestId]);
        this.clusterCallbacks[message.requestId].apply(null, message.response);
        delete this.clusterCallbacks[message.requestId];
        delete this.clusterCallbackTimeouts[message.requestId];
      }
    };
  }

  initialize(callback) {
    let jobs = [];

    // array with the queues to create
    let queuesToCreate = ["client", "subscriber", "tasks"];

    queuesToCreate.forEach((r) => {
      jobs.push((done) => {
        if (this.api.config.redis[r].buildNew === true) {
          // get arguments
          var args = this.api.config.redis[r].args;

          // create a new instance
          this.clients[r] = new this.api.config.redis[r].constructor(args);

          // on error event
          this.clients[r].on("error", (error) => {
            this.api.log(`Redis connection ${r} error`, error);
          });

          // on connect event
          this.clients[r].on("connect", () => {
            this.api.log(`Redis connection ${r} connected`, "info");
            done();
          });
        } else {
          this.clients[r] = this.api.config.redis[r].constructor(this.api.config.redis[r].args);

          this.clients[r].on("error", (error) => {
            this.api.log(`Redis connection ${r} error`, "error", error);
          });
          this.api.log(`Redis connection ${r} connected`, "info");

          done();
        }
      });
    });

    if (!this.status.subscribed) {
      jobs.push((done) => {
        // ensures that clients subscribe the default channel
        this.clients.subscriber.subscribe(this.api.config.general.channel);
        this.status.subscribed = true;

        // on 'message' event execute the handler
        this.clients.subscriber.on("message", (messageChannel, message) => {
          // parse the JSON message if exists
          try {
            message = JSON.parse(message);
          } catch (e) {
            message = {};
          }

          if (
            messageChannel === this.api.config.general.channel &&
            message.serverToken === this.api.config.general.serverToken
          ) {
            if (this.subscriptionHandlers[message.messageType]) {
              this.subscriptionHandlers[message.messageType](message);
            }
          }
        });

        // execute the callback
        done();
      });
    }

    async.series(jobs, callback);
  }

  /**
   * Publish a payload to the redis server.
   *
   * @param payload Payload to be published.
   */
  publish(payload) {
    // get default Redis channel
    let channel = this.api.config.general.channel;

    // publish redis message
    this.clients.client.publish(channel, JSON.stringify(payload));
  }

  // ------------------------------------------------------------------------------------------------------------- [RPC]

  doCluster(method, args, connectionId) {
    return new Promise((resolve, reject) => {
      this._doCluster(method, args, connectionId, (error, res) => {
        if (error) {
          return reject(error);
        }
        resolve(res);
      });
    });
  }

  _doCluster(method, args, connectionId, callback) {
    let requestId = randomUUID();
    let payload = {
      messageType: "do",
      serverId: this.api.id,
      serverToken: this.api.config.general.serverToken,
      requestId: requestId,
      method: method,
      connectionId: connectionId,
      args: args,
    };

    this.publish(payload);

    if (typeof callback === "function") {
      this.clusterCallbacks[requestId] = callback;
      this.clusterCallbackTimeouts[requestId] = setTimeout(
        (requestId) => {
          if (typeof this.clusterCallbacks[requestId] === "function") {
            this.clusterCallbacks[requestId](new Error("RPC Timeout"));
          }
          delete this.clusterCallbacks[requestId];
          delete this.clusterCallbackTimeouts[requestId];
        },
        this.api.config.general.rpcTimeout,
        requestId,
      );
    }
  }

  respondCluster(requestId, response) {
    let payload = {
      messageType: "doResponse",
      serverId: this.api.id,
      serverToken: this.api.config.general.serverToken,
      requestId: requestId,
      response: response, // args to pass back, including error
    };

    this.publish(payload);
  }
}

/**
 * Redis initializer.
 */
export default class {
  /**
   * Initializer load priority.
   *
   * @type {number}
   */
  loadPriority = 200;

  /**
   * Initializer stop priority.
   *
   * @type {number}
   */
  stopPriority = 99999;

  /**
   * Initializer load method.
   *
   * @param api   API reference.
   * @param next  Callback
   */
  load(api, next) {
    // put the redis manager available
    api.redis = new RedisManager(api);

    // initialize redis manager
    api.redis.initialize((error) => {
      // execute the callback if exists an error
      if (error) {
        return next(error);
      }

      api.redis._doCluster("api.log", `Stellar member ${api.id} has joined the cluster`, null, null);

      // finish the loading
      process.nextTick(next);
    });
  }

  /**
   * Stop initializer.
   *
   * @param api   API reference.
   * @param next  Callback.
   */
  stop(api, next) {
    // execute all existent timeouts and remove them
    for (let i in api.redis.clusterCallbackTimeouts) {
      clearTimeout(api.redis.clusterCallbackTimeouts[i]);
      delete api.redis.clusterCallbackTimeouts[i];
      delete api.redis.clusterCallbacks[i];
    }

    // inform the cluster of stellar leaving
    api.redis._doCluster("api.log", `Stellar member ${api.id} has left the cluster`, null, null);

    // unsubscribe stellar instance and finish the stop method execution
    process.nextTick(() => {
      api.redis.clients.subscriber.unsubscribe();
      api.redis.status.subscribed = false;

      ["client", "subscriber", "tasks"].forEach((r) => {
        let client = api.redis.clients[r];
        if (typeof client.quit === "function") {
          client.quit();
        } else if (typeof client.end === "function") {
          client.end();
        } else if (typeof client.disconnect === "function") {
          client.disconnect();
        }
      });

      next();
    });
  }
}
