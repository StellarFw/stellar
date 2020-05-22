import { Satellite } from "@stellarfw/common/lib/satellite";
import { isWorker } from "cluster";
import { LogLevel } from "@stellarfw/common/lib/enums/log-level.enum";

/**
 * Setup the server ID.
 *
 * This ID can be configured using:
 *  - the `general.id` configuration;
 *  - the `--title` option on the command line;
 *  - by the environment variable `STELLAR_TITLE`;
 *  - or one can be generated automatically using the server's external IP.
 */
export default class IDSatellite extends Satellite {
  protected _name: string = "ID";

  public loadPriority: number = 100;
  public startPriority: number = 2;

  public async load(): Promise<void> {
    this.defineEngineName();
    this.api.stellarVersion = this.api.scope.stellarPackageJSON.version;
  }

  public async start(): Promise<void> {
    this.api.log(`server ID: ${this.api.id}`, LogLevel.Notice);
  }

  /**
   * Define the engine instance name.
   */
  private defineEngineName(): void {
    const args = this.api.scope.args;

    if (args.title) {
      this.api.id = args.title;
    } else if (process.env.STELLAR_TITLE) {
      this.api.id = process.env.STELLAR_TITLE;
    } else if (this.api.configs.general && this.api.configs.general.id) {
      this.api.id = this.api.configs.general.id;
    } else {
      const externalIP = this.api.utils.getExternalIPAddress();

      if (externalIP === false) {
        this.api.log(
          " * Error fetching this host external IP address; setting id base to 'stellar'",
        );
        this.api.id = "stellar";
        return;
      }

      this.api.id = externalIP;

      if (isWorker) {
        this.api.id += `:${process.pid}`;
      }
    }
  }
}
