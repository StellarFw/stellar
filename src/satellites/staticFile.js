import fs from "fs";
import path from "path";
import Mime from "mime";

/**
 * Class to manage the static files.
 */
class StaticFile {
  /**
   * API object reference.
   *
   * @type {null}
   */
  api = null;

  /**
   * Search locations.
   *
   * @type {Array}
   */
  searchLocations = [];

  /**
   * Create a new instance of this class.
   *
   * @param api API object reference.
   */
  constructor(api) {
    this.api = api;
  }

  /**
   * Get the public path.
   *
   * @param connection  Client connection object.
   * @param counter
   * @returns {*}
   */
  searchPath(connection, counter = 0) {
    if (this.searchLocations.length === 0 || counter >= this.searchLocations.length) {
      return null;
    } else {
      return this.searchLocations[counter];
    }
  }

  /**
   * Get the content of a file by the 'connection.params.file' var.
   *
   * @param connection  Client connection object.
   * @param callback    Callback function.
   * @param counter
   */
  async get(connection, callback, counter = 0) {
    if (!connection.params.file || !this.searchPath(connection, counter)) {
      this.sendFileNotFound(connection, this.api.config.errors.fileNotProvided(connection), callback);
    } else {
      let file = null;

      if (!path.isAbsolute(connection.params.file)) {
        file = path.normalize(`${this.searchPath(connection, counter)}/${connection.params.file}`);
      } else {
        file = connection.params.file;
      }

      if (file.indexOf(path.normalize(this.searchPath(connection, counter))) !== 0) {
        this.get(connection, callback, counter + 1);
      } else {
        this.checkExistence(file, async (exists, truePath) => {
          if (exists) {
            const {
              connection: connectionObj,
              fileStream,
              mime,
              length,
              lastModified,
              error,
            } = await this.sendFile(truePath, connection);
            if (callback) {
              callback(connectionObj, error, fileStream, mime, length, lastModified);
            }
          } else {
            this.get(connection, callback, counter + 1);
          }
        });
      }
    }
  }

  /**
   * Send a file to the client.
   *
   * @param file
   * @param connection
   */
  async sendFile(file, connection) {
    let lastModified;

    try {
      const stats = await this.api.utils.stats(file);
      const mime = Mime.getType(file);
      const length = stats.size;
      const start = new Date().getTime();
      lastModified = stats.mtime;

      const fileStream = fs.createReadStream(file);
      this.fileLogger(fileStream, connection, start, file, length);

      await new Promise((resolve) => fileStream.on("open", resolve));
      return {
        connection,
        fileStream,
        mime,
        length,
        lastModified,
      };
    } catch (error) {
      return this.sendFileNotFound(connection, this.api.config.errors.fileReadError(connection, String(error)));
    }
  }

  /**
   * Send a file not found error to the client.
   *
   * @param connection    Client connection object.
   * @param errorMessage  Error message to send.
   * @param callback      Callback function.
   */
  sendFileNotFound(connection, errorMessage) {
    connection.error = new Error(errorMessage);

    this.logRequest("{404: not found}", connection, null, null, false);

    return {
      connection,
      error: this.api.config.errors.fileNotFound(connection),
      mime: "text/html",
      length: this.api.config.errors.fileNotFound(connection).length,
    };
  }

  /**
   * Check the existence of a file.
   *
   * @param file
   * @param callback
   */
  checkExistence(file, callback) {
    fs.stat(file, (error, stats) => {
      // if exists an error execute the callback
      // function and return
      if (error) {
        return callback(false, file);
      }

      if (stats.isDirectory()) {
        let indexPath = `${file}/${this.api.config.general.directoryFileType}`;
        this.checkExistence(indexPath, callback);
      } else if (stats.isSymbolicLink()) {
        fs.readlink(file, (error, truePath) => {
          if (error) {
            callback(false, file);
          } else {
            truePath = path.normalize(truePath);
            this.checkExistence(truePath, callback);
          }
        });
      } else if (stats.isFile()) {
        callback(true, file);
      } else {
        callback(false, file);
      }
    });
  }

  /**
   * Log a file request.
   */
  fileLogger(fileStream, connection, start, file, length) {
    fileStream.on("end", () => {
      const duration = new Date().getTime() - start;
      this.logRequest(file, connection, length, duration, true);
    });

    fileStream.on("error", (error) => {
      throw error;
    });
  }

  /**
   * Log file requests.
   *
   * @param file
   * @param connection
   * @param length
   * @param duration
   * @param success
   */
  logRequest(file, connection, length, duration, success) {
    this.api.log(`[ file @ ${connection.type}]`, "debug", {
      to: connection.remoteIP,
      file: file,
      size: length,
      duration: duration,
      success: success,
    });
  }
}

export default class {
  /**
   * Satellite load priority.
   *
   * @type {number}
   */
  loadPriority = 510;

  /**
   * Satellite load function.
   *
   * @param api   API reference object.
   * @param next  Callback function.
   */
  load(api, next) {
    // put static file methods available on the API object
    api.staticFile = new StaticFile(api);

    // load in the explicit public paths first
    if (api.config.general.paths !== undefined) {
      api.staticFile.searchLocations.push(path.normalize(api.config.general.paths.public));
    }

    // finish satellite loading
    next();
  }
}
