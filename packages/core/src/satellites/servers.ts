import { Satellite } from "@stellarfw/common/satellite";
import { GenericServer } from "@stellarfw/common/generic-server";
import { resolve } from "path";
import { LogLevel } from "@stellarfw/common/enums/log-level.enum";

export default class ServersSatellite extends Satellite {
  public loadPriority = 550;
  public startPriority = 900;
  public stopPriority = 100;
  protected _name = "Servers";

  /**
   * Map with all running server instances
   */
  public servers: Map<string, GenericServer> = new Map();

  /**
   * Load all servers.
   */
  private loadServers() {
    // Get all JS files
    const serversFiles = this.api.utils.recursiveDirSearch(
      resolve(`${__dirname}/../servers`),
    );

    for (const file of serversFiles) {
      const ServerClass = require(file).default;
      const options = this.api.configs.servers[ServerClass.serverName];

      if (options && options.enable === true) {
        const server: GenericServer = new ServerClass(this.api, options);
        this.api.log(`Initialized server: ${ServerClass.name}`, LogLevel.Debug);
        this.servers.set(ServerClass.serverName, server);
      }
    }
  }

  /**
   * Start enabled servers.
   */
  private async startServers(): Promise<void> {
    for (const serverName of this.servers.keys()) {
      const server = this.servers.get(serverName);

      if (server.options.enable !== true) {
        continue;
      }

      let message = `Starting server: ${serverName}`;

      // append the bind IP to log message
      if (this.api.configs.servers[serverName].bindIP) {
        message += ` @ ${this.api.configs.servers[serverName].bindIP}`;
      }

      // append the port to log message
      if (this.api.configs.servers[serverName].port) {
        message += ` @ ${this.api.configs.servers[serverName].port}`;
      }

      this.api.log(message, LogLevel.Notice);
      await server.start();
      this.api.log(`Server started: ${serverName}`, LogLevel.Debug);
    }
  }

  /**
   * Stop all running servers.
   */
  private async stopServers(): Promise<void> {
    for (const serverName of this.servers.keys()) {
      const server = this.servers.get(serverName);

      if (server.options.enable !== true) {
        continue;
      }

      this.api.log(`Stopping server: ${serverName}`, LogLevel.Notice);
      await server.stop();
      this.api.log(`Server stopped ${serverName}`, LogLevel.Debug);
    }
  }

  public async load(): Promise<void> {
    this.api.servers = this;

    // Load all enabled servers
    this.api.servers.loadServers();
  }

  public async start(): Promise<void> {
    return this.startServers();
  }

  public async stop(): Promise<void> {
    return this.stopServers();
  }
}
