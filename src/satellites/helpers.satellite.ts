import { Satellite } from "../satellite";
import { GenericServer } from "../generic-server";

import * as UUID from "uuid";
import { LogLevel } from "../log-level.enum";

export class TestServer extends GenericServer {
  constructor(api, type, options) {
    super(api, type, options);
    this.attributes = {
      canChat: true,
      logConnections: false,
      logExits: false,
      sendWelcomeMessage: true,
      verbs: api.connections.allowedVerbs,
    };

    this.on("connection", connection => {
      connection.messages = [];
      connection.actionCallbacks = {};
    });

    this.on("actionComplete", data => {
      data.response.messageCount = data.messageCount;
      data.response.serverInformation = {
        serverName: api.configs.general.serverName,
        apiVersion: api.configs.general.apiVersion,
      };

      data.response.requesterInformation = {
        id: data.connection.id,
        remoteIP: data.connection.remoteIP,
        receivedParams: {},
      };

      if (data.response.error) {
        data.response.error = api.configs.errors.serializers.servers.helper(
          data.response.error,
        );
      }

      for (const k in data.params) {
        if (!data.params.hasOwnProperty(k)) {
          continue;
        }

        data.response.requesterInformation.receivedParams[k] = data.params[k];
      }

      if (data.toRender === true) {
        this.sendMessage(data.connection, data.response, data.messageCount);
      }
    });
  }

  public async start() {
    this.api.log("loading the testServer", LogLevel.Warning);
  }

  public sendMessage(connection, message, messageCount) {
    process.nextTick(() => {
      message.messageCount = messageCount;
      connection.messages.push(message);

      if (typeof connection.actionCallbacks[messageCount] === "function") {
        connection.actionCallbacks[messageCount](message, connection);
        delete connection.actionCallbacks[messageCount];
      }
    });
  }

  public goodbye() {}
}

export default class HelpersSatellite extends Satellite {
  public _name = "Helpers";
  public loadPriority = 800;
  public startPriority = 800;

  public buildConnection() {
    const id = UUID.v4();

    this.api.servers.servers.testServer.buildConnection({
      id,
      rawConnection: {},
      remoteAddress: "testServer",
      remotePort: 0,
    });

    return this.api.connections.connections[id];
  }

  /**
   * Initialize the test server.
   *
   * @param options Server options.
   */
  public async initServer(options) {
    const type = "testServer";
    return new TestServer(this.api, type, options);
  }

  /**
   * Run an action.
   *
   * This creates a fake connection to process the action
   * and return the result on the callback function.
   *
   * @param actionName  Action to be executed.
   * @param input       Action parameters.
   */
  public async runAction(
    actionName: string,
    input: { [key: string]: any } = {},
  ): Promise<any> {
    let connection;

    if (input.id && input.type === "testServer") {
      connection = input;
    } else {
      connection = this.buildConnection();
      connection.params = input;
    }
    connection.params.action = actionName;

    connection.messageCount++;

    return new Promise(resolve => {
      connection.actionCallbacks[connection.messageCount] = resolve;
      this.api.servers.servers.testServer.processAction(connection);
    });
  }

  /**
   * Execute a task.
   *
   * @param taskName  Task to be executed.
   * @param params    Task parameters.
   * @param next      Callback function.
   */
  public runTask(
    taskName: string,
    params: { [key: string]: string } = {},
    next: any,
  ) {
    this.api.tasks.tasks[taskName].run(this.api, params, next);
  }

  public async load() {
    if (this.api.env === "test") {
      this.api.helpers = this;
    }
  }

  public async start() {
    if (this.api.env !== "test") {
      return;
    }

    const server = await this.initServer({});
    this.api.servers.servers.testServer = server;
    return this.api.servers.servers.testServer.start();
  }
}
