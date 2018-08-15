import { SatelliteInterface } from "./satellite.interface";

export abstract class Satellite implements SatelliteInterface {
  public loadPriority: number = 100;
  public startPriority: number = 100;
  public stopPriority: number = 100;

  protected api: any = null;
  protected _name: string = null;

  constructor(api: any) {
    this.api = api;
  }

  public get name(): string {
    return this._name;
  }

  public load(): Promise<void> {
    throw new Error("Method not implemented.");
  }
}
