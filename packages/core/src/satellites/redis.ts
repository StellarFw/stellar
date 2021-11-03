import * as uuid from "uuid";

import { Satellite } from "@stellarfw/common/lib";
import ClusterPayload from "@stellarfw/common/lib/interfaces/cluster-payload.interface";
import { LogLevel } from "@stellarfw/common/lib/enums/log-level.enum";

// export type RedisCallback = (error, message) =>

export default class RedisSatellite extends Satellite {
  protected _name: string = "redis";
  public loadPriority: number = 200;
  public startPriority: number = 101;
  public stopPriority: number = 99999;

  /**
   * Dictionary with all instantiate clients.
   */
  public clients: any = {};

  /**
   * Callbacks.
   */
  public clusterCallbacks = {};

  /**
   * Cluster callback timeouts.
   */
  public clusterCallbackTimeouts = {};

  /**
   * Subscription handlers.
   */
  public subscriptionHandlers: any = {};

  /**
   * Redis manager status.
   */
  public status = {
    subscribed: false,
  };

  private init() {
    // subscription handlers
    this.subscriptionHandlers.do = async (message) => {
      if (!message.connectionId || this.api.connections.connections.get(message.connectionId)) {
        const cmdParts = message.method.split(".");
        const method = this.api.utils.stringToHash(this.api, cmdParts.join("."));

        let args = message.args;
        if (args === null) {
          args = [];
        }

        if (!Array.isArray(args)) {
          args = [args];
        }

        if (method) {
          const response = method.apply(null, args);
          await this.respondCluster(message.requestId, response);
        } else {
          this.api.log(`RP method '${cmdParts.join(".")}' not found`, LogLevel.Warning);
        }
      }
    };

    this.subscriptionHandlers.doResponse = (message: ClusterPayload) => {
      if (!this.clusterCallbacks[message.requestId]) {
        return;
      }

      clearTimeout(this.clusterCallbackTimeouts[message.requestId]);
      this.clusterCallbacks[message.requestId].apply(null, message.response);
      delete this.clusterCallbacks[message.requestId];
      delete this.clusterCallbackTimeouts[message.requestId];
    };
  }

  private initializeClients() {
    const queuesToCreate = ["client", "subscriber", "tasks"];
    const jobs: Array<Promise<void>> = [];

    queuesToCreate.forEach((r) => {
      const newPromise = new Promise<void>((resolve) => {
        if (this.api.configs.redis[r].buildNew !== true) {
          this.clients[r] = this.api.configs.redis[r].constructor(this.api.configs.redis[r].args);

          this.clients[r].on("error", (error) => {
            this.api.log(`Redis connection ${r} error`, LogLevel.Error, error);
          });
          this.api.log(`Redis connection ${r} connected`, LogLevel.Info);
          resolve();
          return;
        }

        const args = this.api.configs.redis[r].args;

        this.clients[r] = new this.api.configs.redis[r].constructor(args);
        this.clients[r].on("error", (error) => {
          this.api.log(`Redis connection ${r} error`, LogLevel.Error, error);
        });

        this.clients[r].on("connect", () => {
          this.api.log(`Redis connection ${r} connected`, LogLevel.Info);
          resolve();
        });
      });

      jobs.push(newPromise);
    });

    if (!this.status.subscribed) {
      const newPromise = new Promise<void>((resolve) => {
        // ensures that clients subscribe the default channel
        this.clients.subscriber.subscribe(this.api.configs.general.channel);
        this.status.subscribed = true;

        this.clients.subscriber.on("message", (messageChannel, message) => {
          try {
            message = JSON.parse(message);
          } catch (e) {
            message = {};
          }

          if (
            messageChannel === this.api.configs.general.channel &&
            message.serverToken === this.api.configs.general.serverToken
          ) {
            if (this.subscriptionHandlers[message.messageType]) {
              this.subscriptionHandlers[message.messageType](message);
            }
          }
        });

        resolve();
      });

      jobs.push(newPromise);
    }

    return Promise.all(jobs);
  }

  /**
   * Execute the given method on the cluster.
   *
   * @param method Method to be executed on the cluster.
   * @param args Arguments to be passed into de called method.
   * @param connectionId (optional) Identifier of the connection that have started the this operation.
   * @param waitingForResponse (optional) Should wait a response from a remote server in the cluster?
   */
  public async doCluster(
    method: string,
    args: string | number | Array<any>,
    connectionId?: string,
    waitForResponse: boolean = false,
  ) {
    const requestId = uuid.v4();
    const payload: ClusterPayload = {
      messageType: "do",
      serverId: this.api.id,
      serverToken: this.api.configs.general.serverToken,
      requestId,
      method,
      connectionId,
      args,
    };

    await this.publish(payload);

    // TODO: improve the following code
    if (waitForResponse === true) {
      new Promise((resolve, reject) => {
        this.clusterCallbacks[requestId] = resolve;

        this.clusterCallbackTimeouts[requestId] = setTimeout(
          () => {
            if (typeof this.clusterCallbacks[requestId] === "function") {
              reject(new Error("RPC Timeout"));
            }

            delete this.clusterCallbacks[requestId];
            delete this.clusterCallbackTimeouts[requestId];
          },
          this.api.configs.general.rpcTimeout,
          requestId,
        );
      });
    }
  }

  /**
   * Publish a payload to the Redis server.
   *
   * @param payload Payload to be published.
   */
  public publish(payload: ClusterPayload) {
    const channel = this.api.configs.general.channel;
    return this.clients.client.publish(channel, JSON.stringify(payload));
  }

  /**
   * Sent a response to the cluster.
   *
   * @param requestId Response identifier.
   * @param response Response data.
   */
  public async respondCluster(requestId: string, response: any) {
    const payload: ClusterPayload = {
      messageType: "doResponse",
      serverId: this.api.id,
      serverToken: this.api.configs.general.serverToken,
      requestId,
      response,
    };

    await this.publish(payload);
  }

  public async load(): Promise<void> {
    this.api.redis = this;

    this.init();
    await this.initializeClients();
  }

  public async start(): Promise<void> {
    await this.doCluster("log", `Stellar member ${this.api.id} has joined the cluster`);
  }

  public async stop(): Promise<void> {
    if (this.api.configs.redis.enabled === false) {
      return;
    }

    // Remove all existing callbacks
    for (const key of Object.keys(this.clusterCallbackTimeouts)) {
      clearTimeout(this.clusterCallbackTimeouts[key]);
      delete this.clusterCallbackTimeouts[key];
      delete this.clusterCallbacks[key];
    }

    this.doCluster("log", `Stellar member ${this.api.id} has left the cluster`);

    // TODO: stop subscriber

    const clientsIdentifier = ["client", "subscriber", "tasks"];

    for (const key of clientsIdentifier) {
      if (!clientsIdentifier.hasOwnProperty(key)) {
        continue;
      }

      const client = this.clients[key];

      if (typeof client.quit === "function") {
        await client.quit();
      } else if (typeof client.end === "function") {
        await client.end();
      } else if (typeof client.disconnect === "function") {
        await client.disconnect();
      }
    }
  }
}
