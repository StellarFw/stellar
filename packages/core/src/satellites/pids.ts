import { Satellite } from "@stellarfw/common/lib/satellite";
import { LogLevel } from "@stellarfw/common/lib/enums/log-level.enum";
import { isMaster } from "cluster";
import { mkdirSync, writeFileSync, unlinkSync } from "fs";

class Pids {
  private api: any = null;

  /**
   * Process ID.
   */
  public pid: number = null;

  /**
   * Pids folder.
   */
  public path: string = null;

  /**
   * Process title.
   */
  public title: string = null;

  constructor(api: any) {
    this.api = api;
  }

  public init(): void {
    this.pid = process.pid;
    this.path = this.api.configs.general.paths.pid;

    if (isMaster) {
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
    return this.api.id
      .replace(/:/g, "-")
      .replace(/\s/g, "-")
      .replace(/\r/g, "")
      .replace(/\n/g, "");
  }
}

export default class PidsSatellite extends Satellite {
  protected _name: string = "pids";
  public loadPriority: number = 110;
  public startPriority: number = 1;

  public async load(): Promise<void> {
    this.api.pids = new Pids(this.api);
    this.api.pids.init();
  }

  public async start(): Promise<void> {
    this.api.pids.writePidFile();
    this.api.log(`pid: ${process.pid}`, LogLevel.Notice);
  }
}
