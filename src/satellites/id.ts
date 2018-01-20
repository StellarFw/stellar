import { Satellite } from '../satellite';

export default class IDSatellite extends Satellite {
  protected _name: string = 'ID';

  public loadPriority: number = 100;
  public startPriority: number = 2;

  public async load(): Promise<void> {
    console.log('>>>', this.api.scope);
  }
}
