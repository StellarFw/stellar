import { IActionMetadata } from "../interfaces/action.interface";
import { LogLevel } from "../enums/log-level.enum";
import { ACTION_METADATA } from "../constants";

const DEFAULT_METADATA: IActionMetadata = {
  version: 1.0,
  inputs: {},
  middleware: [],
  logLevel: LogLevel.Info,
  toDocument: false,
  protected: false,
  private: false,
};

/**
 * Injects Action metadata.
 */
export function ActionMetadata(metadata: IActionMetadata): ClassDecorator {
  const metadataToSet: IActionMetadata = {
    ...DEFAULT_METADATA,
    ...metadata,
  };

  return (target: object) => {
    Reflect.defineMetadata(ACTION_METADATA, metadataToSet, target);
  };
}
