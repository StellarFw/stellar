import { SatelliteInterface } from './satellite.interface';


export abstract class Satellite implements SatelliteInterface {
  public loadPriority: number = 100;
  public startPriority: number = 100;
  public stopPriority: number = 100;

  protected api: any = null;

  constructor(api: any) {
    this.api = api;
  }

  public load(): Promise<void> {
    throw new Error('Method not implemented.')
  }
}
