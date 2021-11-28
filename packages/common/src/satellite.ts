import { API, panic } from ".";
import { SatelliteInterface } from "./interfaces/satellite.interface";

export abstract class Satellite implements SatelliteInterface {
  public loadPriority = 100;
  public startPriority = 100;
  public stopPriority = 100;

  protected api!: API;
  protected _name!: string;

  constructor(api) {
    this.api = api;
  }

  public get name(): string {
    return this._name;
  }

  public load(): Promise<void> {
    panic("Method not implemented.");
  }
}
