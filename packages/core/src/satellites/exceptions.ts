import { Satellite } from "@stellarfw/common/satellite";
import { LogLevel } from "@stellarfw/common/enums/log-level.enum";
import { EOL } from "os";

export enum ExceptionType {
  LOADER = "satellite",
  ACTION = "action",
  TASK = "task",
  OTHER = "other",
}

/**
 * Type of the handler for the exceptions.
 */
export type ExceptionHandler = (
  err: Error | string,
  type: ExceptionType,
  name: string,
  objects: any,
  severity: LogLevel,
) => void;

export default class ExceptionsSatellite extends Satellite {
  protected _name: string = "exceptions";
  public loadPriority: number = 130;

  /**
   * Array with the exceptions reporters.
   */
  private reporters: Array<ExceptionHandler> = [];

  public async load(): Promise<void> {
    this.api.exceptionHandlers = this;
    this.reporters.push(this.defaultConsoleHandler.bind(this));
  }

  private defaultConsoleHandler(
    err: Error | string,
    type: ExceptionType = ExceptionType.OTHER,
    name: string = "",
    objects: any = [],
    severity: LogLevel = LogLevel.Error,
  ): void {
    let output = "";
    let lines = [];
    const extraMessages = [];

    if (typeof err === "string") {
      err = new Error(err);
    }

    if (type === ExceptionType.LOADER) {
      extraMessages.push(`Failed to load ${objects.fullFilePath}\n`);
    } else if (type === ExceptionType.ACTION) {
      extraMessages.push(`Uncaught error from action: ${name}\n`);
      extraMessages.push("Connection details:");

      const relevantDetails = ["action", "remoteIP", "type", "params", "room"];
      for (const detailName of relevantDetails) {
        if (
          objects.connection[detailName] !== null &&
          objects.connection[detailName] !== undefined &&
          typeof objects.connection[detailName] !== "function"
        ) {
          extraMessages.push(
            `    ${detailName}: ${JSON.stringify(
              objects.connection[detailName],
            )}`,
          );
        }
      }
      extraMessages.push("");
    } else if (type === ExceptionType.TASK) {
      extraMessages.push(
        `Uncaught error from task: ${name} on queue ${objects.queue} (worker #${
          objects.workerId
        })\n`,
      );
      try {
        extraMessages.push(
          "    arguments: " + JSON.stringify(objects.task.args),
        );
      } catch (e) {}
    } else {
      extraMessages.push(`Error: ${err.message}\n`);
      extraMessages.push(`    Type: ${type}`);
      extraMessages.push(`    Name: ${name}`);
      extraMessages.push(`    Data: ${JSON.stringify(objects)}`);
    }

    // reduce the extra messages into a single string
    output += extraMessages.reduce((prev, item) => prev + `${item} \n`, "");

    // add the stack trace
    lines = lines.concat(err.stack.split(EOL));

    // reduce the lines array into a single string
    output += lines.reduce((prev, item) => prev + `${item}\n`, "");

    // print out the output message
    this.api.log(output, severity);
  }

  /**
   * Execute reporters.
   *
   * @param err
   * @param type
   * @param name
   * @param objects
   * @param severity
   */
  private report(
    err: Error | string,
    type: ExceptionType,
    name: string,
    objects: any,
    severity = LogLevel.Error,
  ) {
    this.reporters.forEach(reporter => {
      reporter.call(this, err, type, name, objects, severity);
    });
  }

  /**
   * Loader exception.
   *
   * @param fullFilePath
   * @param err
   */
  public loader(fullFilePath: string, err: Error | string) {
    const name = `loader ${fullFilePath}`;
    this.report(
      err,
      ExceptionType.LOADER,
      name,
      { fullFilePath },
      LogLevel.Alert,
    );
  }

  /**
   * Handler for action exceptions.
   *
   * @param err
   * @param data
   * @param next
   */
  public action(err: Error, data: any = {}) {
    let simpleName: string = null;

    // try get the action name. Sometimes this can be impossible so we use the
    // error message instead.
    try {
      simpleName = data.action;
    } catch (e) {
      simpleName = err.message;
    }

    this.report(
      err,
      ExceptionType.ACTION,
      simpleName,
      { connection: data.connection },
      LogLevel.Error,
    );
    data.response = {};
  }

  /**
   * Exception handler for tasks.
   *
   * @param error       Error object.
   * @param queue       Queue here the error occurs
   * @param task
   * @param workerId
   */
  // TODO: add task interface
  public task(error: Error, queue: Array<string>, task: any, workerId: number) {
    let simpleName: string = null;

    try {
      simpleName = task.class;
    } catch (e) {
      simpleName = error.message;
    }

    this.report(
      error,
      ExceptionType.TASK,
      `task:${simpleName}`,
      {
        task,
        queue,
        workerId,
      },
      this.api.configs.tasks.workerLogging.failure,
    );
  }
}
