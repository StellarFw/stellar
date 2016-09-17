'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _mime = require('mime');

var _mime2 = _interopRequireDefault(_mime);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Class to manage the static files.
 */
var StaticFile = function () {

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
  function StaticFile(api) {
    _classCallCheck(this, StaticFile);

    this.api = null;
    this.searchLocations = [];

    var self = this;

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


  _createClass(StaticFile, [{
    key: 'searchPath',
    value: function searchPath(connection) {
      var counter = arguments.length <= 1 || arguments[1] === undefined ? 0 : arguments[1];

      var self = this;

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

  }, {
    key: 'get',
    value: function get(connection, callback) {
      var counter = arguments.length <= 2 || arguments[2] === undefined ? 0 : arguments[2];

      var self = this;

      if (!connection.params.file || !self.searchPath(connection, counter)) {
        self.sendFileNotFound(connection, self.api.config.errors.fileNotProvided(connection), callback);
      } else {
        var file = null;

        if (!_path2.default.isAbsolute(connection.params.file)) {
          file = _path2.default.normalize(self.searchPath(connection, counter) + '/' + connection.params.file);
        } else {
          file = connection.params.file;
        }

        if (file.indexOf(_path2.default.normalize(self.searchPath(connection, counter))) !== 0) {
          self.get(connection, callback, counter + 1);
        } else {
          self.checkExistence(file, function (exists, truePath) {
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

  }, {
    key: 'sendFile',
    value: function sendFile(file, connection, callback) {
      var self = this;
      var lastModified = void 0;

      // get file information
      _fs2.default.stat(file, function (err, stats) {
        // check if is an error
        if (err) {
          // if we can't read the file respond with an error
          self.sendFileNotFound(connection, self.api.config.errors.fileReadError(String(err)), callback);
        } else {
          (function () {
            var mime = _mime2.default.lookup(file);
            var length = stats.size;
            var fileStream = _fs2.default.createReadStream(file);
            var start = new Date().getTime();

            lastModified = stats.mtime;

            // add a listener to the 'close' event
            fileStream.on('close', function () {
              var duration = new Date().getTime() - start;
              self.logRequest(file, connection, length, duration, true);
            });

            // add a listener to the 'error' event
            fileStream.on('error', function (err) {
              self.api.log(err);
            });

            // execute the callback
            callback(connection, null, fileStream, mime, length, lastModified);
          })();
        }
      });
    }

    /**
     * Send a file not found error to the client.
     *
     * @param connection    Client connection object.
     * @param errorMessage  Error message to send.
     * @param callback      Callback function.
     */

  }, {
    key: 'sendFileNotFound',
    value: function sendFileNotFound(connection, errorMessage, callback) {
      var self = this;

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

  }, {
    key: 'checkExistence',
    value: function checkExistence(file, callback) {
      var self = this;

      _fs2.default.stat(file, function (error, stats) {
        // if exists an error execute the callback
        // function and return
        if (error) {
          callback(false, file);
          return;
        }

        if (stats.isDirectory()) {
          var indexPath = file + '/' + self.api.config.general.directoryFileType;
          self.checkExistence(indexPath, callback);
        } else if (stats.isSymbolicLink()) {
          _fs2.default.readlink(file, function (error, truePath) {
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
     * Log file requests.
     *
     * @param file
     * @param connection
     * @param length
     * @param duration
     * @param success
     */

  }, {
    key: 'logRequest',
    value: function logRequest(file, connection, length, duration, success) {
      var self = this;

      self.api.log('[ file @ ' + connection.type + ']', 'debug', {
        to: connection.remoteIP,
        file: file,
        size: length,
        duration: duration,
        success: success
      });
    }
  }]);

  return StaticFile;
}();

var _class = function () {
  function _class() {
    _classCallCheck(this, _class);

    this.loadPriority = 510;
  }

  /**
   * Satellite load priority.
   *
   * @type {number}
   */


  _createClass(_class, [{
    key: 'load',


    /**
     * Satellite load function.
     *
     * @param api   API reference object.
     * @param next  Callback function.
     */
    value: function load(api, next) {
      // put static file methods available on the API object
      api.staticFile = new StaticFile(api);

      // load in the explicit public paths first
      if (api.config.general.paths !== undefined) {
        api.staticFile.searchLocations.push(_path2.default.normalize(api.config.general.paths.public));
      }

      // finish satellite loading
      next();
    }
  }]);

  return _class;
}();

exports.default = _class;