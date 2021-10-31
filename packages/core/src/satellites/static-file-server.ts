import { Satellite } from "@stellarfw/common/lib";
import { normalize, isAbsolute } from "path";
import ConnectionDetails from "@stellarfw/common/lib/interfaces/connection-details.interface";
import { LogLevel } from "@stellarfw/common/lib/enums/log-level.enum";
import { promisify } from "util";
import { stat, createReadStream, readlink, ReadStream } from "fs";

import * as Mime from "mime";

export interface FileResponse {
  connection: ConnectionDetails;
  fileStream?: ReadStream;
  mime: string;
  length: number;
  lastModified?: Date;
  error?: string;
}

/**
 * Satellite to manager static files.
 */
export default class StaticFileServer extends Satellite {
  protected _name: string = "StaticFile";
  public loadPriority: number = 510;

  /**
   * Array with search paths to be used during a file request.
   */
  private searchLocations: Array<string> = [];

  public async sendFile(
    file: string,
    connection: ConnectionDetails
  ): Promise<FileResponse> {
    const fsStat = promisify(stat);

    try {
      const stats = await fsStat(file);

      const mime = Mime.getType(file);
      const length = stats.size;
      const fileStream = createReadStream(file);
      const start = new Date().getTime();

      const lastModified = stats.mtime;

      fileStream.on("close", () => {
        const duration = new Date().getTime() - start;
        this.logRequest(file, connection, length, duration, true);
      });

      const response: FileResponse = {
        connection,
        fileStream,
        mime,
        length,
        lastModified,
      };
      return response;
    } catch (error) {
      return this.sendFileNotFound(
        connection,
        this.api.configs.errors.fileReadError(String(error))
      );
    }
  }

  /**
   * Send a file not found error to the client.
   *
   * @param connection Client connection object.
   * @param errorMessage Error message to send.
   */
  public sendFileNotFound(
    connection: ConnectionDetails,
    errorMessage: string
  ): FileResponse {
    connection.error = new Error(errorMessage);
    this.logRequest("{404: not found}", connection, null, null, false);

    const originalError = this.api.configs.errors.fileNotFound();
    const error: string =
      typeof originalError === "string"
        ? originalError
        : JSON.stringify(originalError);

    return {
      connection,
      error,
      mime: "text/html",
      length: error.length,
    } as FileResponse;
  }

  /**
   * Get the public path.
   *
   * @param connection Client connection object.
   * @param counter Counter position
   */
  private searchPath(
    connection: ConnectionDetails,
    counter: number = 0
  ): null | string {
    if (
      this.searchLocations.length === 0 ||
      counter >= this.searchLocations.length
    ) {
      return null;
    }

    return this.searchLocations[counter];
  }

  /**
   * Log file request.
   *
   * @param file File path to be logged.
   * @param connection Client connection that originated the request.
   * @param length Content length.
   * @param duration Search duration.
   * @param success Informs if is a success or not.
   */
  private logRequest(
    file: string,
    connection: ConnectionDetails,
    length: number | null,
    duration: number | null,
    success: boolean = true
  ) {
    this.api.log(`[file @ ${connection.type}]`, LogLevel.Debug, {
      to: connection.remoteIP,
      file,
      size: length,
      duration,
      success,
    });
  }

  public async get(
    connection: ConnectionDetails,
    counter: number = 0
  ): Promise<FileResponse> {
    if (!connection.params.file || !this.searchPath(connection, counter)) {
      return this.sendFileNotFound(
        connection,
        this.api.configs.errors.fileNotFound()
      );
    }

    let file: string = connection.params.file;

    if (!isAbsolute(connection.params.file)) {
      file = normalize(
        this.searchPath(connection, counter) + "/" + connection.params.file
      );
    }

    if (file.indexOf(normalize(this.searchPath(connection, counter)!)) !== 0) {
      return this.get(connection, counter + 1);
    }

    try {
      const truePath = await this.checkExistence(file);
      return this.sendFile(truePath, connection);
    } catch (error) {
      return this.get(connection, counter + 1);
    }
  }

  public async load() {
    this.api.staticFile = this;

    // Load in the explicit public paths first
    if (this.api.configs.general.paths !== undefined) {
      this.searchLocations.push(
        normalize(this.api.configs.general.paths.public)
      );
    }
  }

  /**
   * Check the existence of a file.
   *
   * @param file File to check.
   */
  private async checkExistence(file: string): Promise<string> {
    const statP = promisify(stat);
    const stats = await statP(file);

    if (stats.isDirectory()) {
      const indexPath = `${file}/${this.api.configs.general.directoryFileType}`;
      return this.checkExistence(indexPath);
    } else if (stats.isSymbolicLink()) {
      const readlinkP = promisify(readlink);
      let truePath = await readlinkP(file);
      truePath = normalize(file);
      return this.checkExistence(truePath);
    } else if (stats.isFile()) {
      return file;
    }

    throw new Error("File does not exists");
  }
}
