import { Satellite, LogLevel } from "@stellarfw/common/lib/index.js";
import cluster from "cluster";
import { mkdirSync, writeFileSync, unlinkSync } from "fs";

class Pids {
  private api: any;

  /**
   * Process ID.
   */
  public pid!: number;

  /**
   * Pids folder.
   */
  public path!: string;

  /**
   * Process title.
   */
  public title!: string;

  constructor(api: any) {
    this.api = api;
  }

  public init(): void {
    this.pid = process.pid;
    this.path = this.api.configs.general.paths.pid;

    if (cluster.isPrimary) {
      this.title = `stellar-${this.sanitizeId()}`;
    } else {
      this.title = this.sanitizeId();
    }

    try {
      mkdirSync(this.path);
    } catch (error) {}
  }

  /**
   * Write pid file.
   */
  public writePidFile(): void {
    writeFileSync(`${this.path}/${this.title}`, this.pid.toString(), "ascii");
  }

  /**
   * Remove pid file.
   */
  public cleanPidFile(): void {
    try {
      unlinkSync(`${this.path}/${this.title}`);
    } catch (error) {
      this.api.log("Unable to remove pid file", LogLevel.Error, error);
    }
  }

  /**
   * Get a sanitized pid name for this process.
   */
  private sanitizeId(): string {
    return this.api.id.replace(/:/g, "-").replace(/\s/g, "-").replace(/\r/g, "").replace(/\n/g, "");
  }
}

export default class PidsSatellite extends Satellite {
  protected _name = "pids";
  public loadPriority = 110;
  public startPriority = 1;

  public async load(): Promise<void> {
    this.api.pids = new Pids(this.api);
    this.api.pids.init();
  }

  public async start(): Promise<void> {
    this.api.pids.writePidFile();
    this.api.log(`pid: ${process.pid}`, LogLevel.Notice);
  }
}
