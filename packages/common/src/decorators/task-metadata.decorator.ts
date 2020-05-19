import { ITaskMetadata } from "../interfaces/task-metadata.interface";
import { TASK_METADATA } from "../constants";

export function TaskMetadata(metadata: ITaskMetadata): ClassDecorator {
  const metadataToSet: ITaskMetadata = {
    ...metadata,
  };

  return (target: object) => {
    Reflect.defineMetadata(TASK_METADATA, metadataToSet, target);
  };
}
