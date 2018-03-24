import { Satellite } from '../satellite';

export default class ParamsSatellite extends Satellite {
  protected _name: string = 'params';
  public loadPriority: number = 420;

  /**
   * Special params.
   */
  private globalSafeParams: Array<string> = [
    'file',
    'apiVersion',
    'callback',
    'action',
  ];

  /**
   * List with all save params.
   */
  private postVariables: Array<string> = [];

  /**
   * Build a dictionary with all safe application params.
   */
  private buildPostVariables() {
    // Add global safe params.
    this.postVariables.concat(this.globalSafeParams);

    // TODO: implement action first
  }

  public async load(): Promise<void> {
    this.api.params = this;
    this.buildPostVariables();
  }
}
