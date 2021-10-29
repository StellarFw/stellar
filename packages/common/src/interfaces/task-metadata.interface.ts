/**
 * Type for the task's inputs.
 */
export interface TaskInputMap {
  [key: string]: any;
}

/**
 * Type of the task handler function.
 */
export type TaskFn = (api: any, params: TaskInputMap, next: Function) => void;

export interface ITaskMetadata {
  /**
   * Name of the task, which must be unique.
   */
  name: string;

  /**
   * Must contain a short description of the purpose of the task.
   */
  description: string;

  /**
   * Queue which will run the task, by default this property is set to
   * default. This value can be replaced when using the
   * api.tasks.enqueue methods.
   */
  queue: string;

  /**
   * If the value is greater than zero, the task will be considered a
   * periodic task and will run once every interval specified by the
   * number of milliseconds defined in this property.
   */
  frequency: number;

  /**
   * In this property you can define an array of resque plugins;
   * these plugins modify how tasks are inserted in the queue.
   * You can read more about this in the node-resque docs.
   */
  plugins: Array<any>;

  /**
   * This is an object with options for plugins.
   */
  pluginOptions: any;

  /**
   * Function handler for the task.
   */
  run: TaskFn;
}
