import fs from 'fs';
import path from 'path';
import Mime from 'mime';

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
   * Create a new instance of this class.
   *
   * @param api API object reference.
   */
  constructor(api) {
    this.api = api;
  }

  /**
   * Get the lublig path.
   *
   * @param connection
   * @param counter
   * @returns {*}
   */
  path(connection, counter = 0) {
    let self = this;

    if (self.api.config.general.paths === undefined ||
      self.api.config.general.paths.public.length === 0 ||
      counter >= self.api.config.general.paths.public.length) {
      return null;
    } else {
      return self.api.config.general.paths.public[ counter ];
    }
  }

  /**
   * Get the content of a file by the 'connection.params.file' var.
   *
   * @param connection
   * @param callback
   * @param counter
   */
  get(connection, callback, counter = 0) {
    let self = this;

    if (!connection.params.file || !self.path(connection, counter)) {
      self.sendFileNotFound(connection, self.api.config.errors.fileNotProvided(), callback);
    } else {
      let file = path.normalize(self.path(connection, counter) + '/' + connection.params.file);

      if (file.indexOf(path.normalize(self.path(connection, counter))) !== 0) {
        self.get(connection, callback, counter + 1);
      } else {
        self.checkExistence(file, (exists, truePath) => {
          if (exists) {
            self.sendFile(truePath, connection, callback);
          } else {
            self.get(connection, callback, counter + 1);
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
   * @param callback
   */
  sendFile(file, connection, callback) {
    let self = this;
    let lastModified;

    // get file information
    fs.stat(file, (err, stats) => {
      // check if is an error
      if (err) {
        // if we can't read the file respond with an error
        self.sendFileNotFound(connection, self.api.config.errors.fileReadError(String(err)), callback);
      } else {
        let mime = Mime.lookup(file);
        let length = stats.size;
        let fileStream = fs.createReadStream(file);
        let start = new Date().getTime();

        lastModified = stats.mtime;

        // add a listener to the 'close' event
        fileStream.on('close', () => {
          let duration = new Date().getTime() - start;
          self.logRequest(file, connection, length, duration, true);
        });

        // add a listener to the 'error' event
        fileStream.on('error', (err) => {
          self.api.log(err);
        });

        // execute the callback
        callback(connection, null, fileStream, mime, length, lastModified);
      }
    });
  }

  /**
   * Send a file not found error to the client.
   *
   * @param connection
   * @param errorMessage
   * @param callback
   */
  sendFileNotFound(connection, errorMessage, callback) {
    let self = this;

    connection.error = new Error(errorMessage);
    self.logRequest('{404: not found}', connection, null, null, false);
    callback(connection, self.api.config.errors.fileNotFound(), null, 'text/html', self.api.config.errors.fileNotFound().length);
  }

  /**
   * Check the existence of a file.
   *
   * @param file
   * @param callback
   */
  checkExistence(file, callback) {
    let self = this;

    fs.stat(file, (err, stats) => {
      if (err) {
        callback(false, file);
      } else {
        if (stats.isDirectory()) {
          let indexPath = file + '/' + self.api.config.general.directoryFileType;
          self.checkExistence(indexPath, callback);
        } else if (stats.isSymbolicLink()) {
          fs.readlink(file, (err, truePath) => {
            if (err) {
              callback(false, file);
            } else {
              truePath = path.normalize(truePath);
              self.checkExistence(truePath, callback);
            }
          });
        } else if (stats.isFile()) {
          callback(true, file);
        } else {
          callback(false, file);
        }
      }
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
    let self = this;

    self.api.log(`[ file @ ${connection.type}]`, 'debug', {
      to: connection.remoteIP,
      file: file,
      size: length,
      duration: duration,
      success: success
    });
  }
}

export default class {

  static loadPriority = 510;

  static load(api, next) {
    api.staticFile = new StaticFile(api);
    next();
  }
};
