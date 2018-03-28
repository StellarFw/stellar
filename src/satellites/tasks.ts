import { Satellite } from '../satellite';

export interface InternalJob {
  plugins: Array<any>;
  pluginsOptions: Array<any>;
  perform: () => {};
}

export default class TasksSatellite extends Satellite {
  public jobs: Map<string, InternalJob> = new Map();

  public loadPriority: number = 699;
  public startPriority: number = 900;

  public async load(): Promise<void> {
    this.api.tasks = this;

    // TODO: load modules' tasks
  }

  public async start(): Promise<void> {}
}
