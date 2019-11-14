'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _mime = require('mime');

var _mime2 = _interopRequireDefault(_mime);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

/**
 * Class to manage the static files.
 */
class StaticFile {

  /**
   * Create a new instance of this class.
   *
   * @param api API object reference.
   */

  /**
   * API object reference.
   *
   * @type {null}
   */
  constructor(api) {
    this.api = null;
    this.searchLocations = [];

    let self = this;

    // save API reference object
    self.api = api;
  }

  /**
   * Get the public path.
   *
   * @param connection  Client connection object.
   * @param counter
   * @returns {*}
   */


  /**
   * Search locations.
   *
   * @type {Array}
   */
  searchPath(connection, counter = 0) {
    let self = this;

    if (self.searchLocations.length === 0 || counter >= self.searchLocations.length) {
      return null;
    } else {
      return self.searchLocations[counter];
    }
  }

  /**
   * Get the content of a file by the 'connection.params.file' var.
   *
   * @param connection  Client connection object.
   * @param callback    Callback function.
   * @param counter
   */
  get(connection, callback, counter = 0) {
    var _this = this;

    return _asyncToGenerator(function* () {
      let self = _this;

      if (!connection.params.file || !self.searchPath(connection, counter)) {
        self.sendFileNotFound(connection, self.api.config.errors.fileNotProvided(connection), callback);
      } else {
        let file = null;

        if (!_path2.default.isAbsolute(connection.params.file)) {
          file = _path2.default.normalize(self.searchPath(connection, counter) + '/' + connection.params.file);
        } else {
          file = connection.params.file;
        }

        if (file.indexOf(_path2.default.normalize(self.searchPath(connection, counter))) !== 0) {
          self.get(connection, callback, counter + 1);
        } else {
          self.checkExistence(file, (() => {
            var _ref = _asyncToGenerator(function* (exists, truePath) {
              if (exists) {
                const {
                  connection: connectionObj,
                  fileStream,
                  mime,
                  length,
                  lastModified,
                  error
                } = yield self.sendFile(truePath, connection);
                if (callback) {
                  callback(connectionObj, error, fileStream, mime, length, lastModified);
                }
              } else {
                self.get(connection, callback, counter + 1);
              }
            });

            return function (_x, _x2) {
              return _ref.apply(this, arguments);
            };
          })());
        }
      }
    })();
  }

  /**
   * Send a file to the client.
   *
   * @param file
   * @param connection
   */
  sendFile(file, connection) {
    var _this2 = this;

    return _asyncToGenerator(function* () {
      let lastModified;

      try {
        const stats = yield _this2.api.utils.stats(file);
        const mime = _mime2.default.getType(file);
        const length = stats.size;
        const start = new Date().getTime();
        lastModified = stats.mtime;

        const fileStream = _fs2.default.createReadStream(file);
        _this2.fileLogger(fileStream, connection, start, file, length);

        yield new Promise(function (resolve) {
          return fileStream.on('open', resolve);
        });
        return {
          connection,
          fileStream,
          mime,
          length,
          lastModified
        };
      } catch (error) {
        return _this2.sendFileNotFound(connection, _this2.api.config.errors.fileReadError(String(error)));
      }
    })();
  }

  /**
   * Send a file not found error to the client.
   *
   * @param connection    Client connection object.
   * @param errorMessage  Error message to send.
   * @param callback      Callback function.
   */
  sendFileNotFound(connection, errorMessage, callback) {
    let self = this;

    // add error message
    connection.error = new Error(errorMessage);

    // load 404 error
    self.logRequest('{404: not found}', connection, null, null, false);

    // execute the callback function
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

    _fs2.default.stat(file, (error, stats) => {
      // if exists an error execute the callback
      // function and return
      if (error) {
        return callback(false, file);
      }

      if (stats.isDirectory()) {
        let indexPath = file + '/' + self.api.config.general.directoryFileType;
        self.checkExistence(indexPath, callback);
      } else if (stats.isSymbolicLink()) {
        _fs2.default.readlink(file, (error, truePath) => {
          if (error) {
            callback(false, file);
          } else {
            truePath = _path2.default.normalize(truePath);
            self.checkExistence(truePath, callback);
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
    fileStream.on('end', () => {
      const duration = new Date().getTime() - start;
      this.logRequest(file, connection, length, duration, true);
    });

    fileStream.on('error', error => {
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

exports.default = class {
  constructor() {
    this.loadPriority = 510;
  }
  /**
   * Satellite load priority.
   *
   * @type {number}
   */


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
      api.staticFile.searchLocations.push(_path2.default.normalize(api.config.general.paths.public));
    }

    // finish satellite loading
    next();
  }
};