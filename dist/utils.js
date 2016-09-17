'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _os = require('os');

var _os2 = _interopRequireDefault(_os);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Utils = function () {
  function Utils() {
    _classCallCheck(this, Utils);
  }

  _createClass(Utils, null, [{
    key: 'getFiles',


    /**
     * Read all files from the given directory.
     *
     * @param dir         Folder path to search.
     * @returns {Array}   Array with the files paths.
     */
    value: function getFiles(dir) {
      var results = [];

      _fs2.default.readdirSync(dir).forEach(function (file) {
        file = dir + '/' + file;
        var stat = _fs2.default.statSync(file);

        if (stat && !stat.isDirectory()) {
          results.push(file);
        }
      });

      return results;
    }

    /**
     * Get all .js files in a directory.
     *
     * @param dir
     * @param extension
     * @returns {Array.<T>}
     */

  }, {
    key: 'recursiveDirectoryGlob',
    value: function recursiveDirectoryGlob(dir, extension) {
      var results = [];

      if (!extension) {
        extension = 'js';
      }

      extension = extension.replace('.', '');
      if (dir[dir.length - 1] !== '/') {
        dir += '/';
      }

      if (_fs2.default.existsSync(dir)) {
        _fs2.default.readdirSync(dir).forEach(function (file) {
          var fullFilePath = _path2.default.normalize(dir + file);
          if (file[0] !== '.') {
            // ignore 'system' files
            var stats = _fs2.default.statSync(fullFilePath);
            var child = void 0;

            if (stats.isDirectory()) {
              child = Utils.recursiveDirectoryGlob(fullFilePath, extension);
              child.forEach(function (c) {
                return results.push(c);
              });
            } else if (stats.isSymbolicLink()) {
              var realPath = _fs2.default.readlinkSync(fullFilePath);
              child = Utils.recursiveDirectoryGlob(realPath);
              child.forEach(function (c) {
                return results.push(c);
              });
            } else if (stats.isFile()) {
              var fileParts = file.split('.');
              var ext = fileParts[fileParts.length - 1];
              if (ext === extension) {
                results.push(fullFilePath);
              }
            }
          }
        });
      }

      return results.sort();
    }

    /**
     * Merge two hashes recursively.
     *
     * @param a
     * @param b
     * @param arg
     * @returns {{}}
     */

  }, {
    key: 'hashMerge',
    value: function hashMerge(a, b, arg) {
      var c = {};
      var i = void 0,
          response = void 0;

      for (i in a) {
        if (Utils.isPlainObject(a[i]) && Object.keys(a[i]).length > 0) {
          c[i] = Utils.hashMerge(c[i], a[i], arg);
        } else {
          if (typeof a[i] === 'function') {
            response = a[i](arg);
            if (Utils.isPlainObject(response)) {
              c[i] = Utils.hashMerge(c[i], response, arg);
            } else {
              c[i] = response;
            }
          } else {
            c[i] = a[i];
          }
        }
      }
      for (i in b) {
        if (Utils.isPlainObject(b[i]) && Object.keys(b[i]).length > 0) {
          c[i] = Utils.hashMerge(c[i], b[i], arg);
        } else {
          if (typeof b[i] === 'function') {
            response = b[i](arg);
            if (Utils.isPlainObject(response)) {
              c[i] = Utils.hashMerge(c[i], response, arg);
            } else {
              c[i] = response;
            }
          } else {
            c[i] = b[i];
          }
        }
      }
      return c;
    }

    /**
     * Check if the passed argument is a plain object.
     *
     * @param o
     * @returns {boolean}
     */

  }, {
    key: 'isPlainObject',
    value: function isPlainObject(o) {
      var safeTypes = [Boolean, Number, String, Function, Array, Date, RegExp, Buffer];
      var safeInstances = ['boolean', 'number', 'string', 'function'];
      var expandPreventMatchKey = '_toExpand'; // set `_toExpand = false` within an object if you don't want to expand it
      var i = void 0;

      if (!o) {
        return false;
      }
      if (o instanceof Object === false) {
        return false;
      }
      for (i in safeTypes) {
        if (o instanceof safeTypes[i]) {
          return false;
        }
      }
      for (i in safeInstances) {
        if ((typeof o === 'undefined' ? 'undefined' : _typeof(o)) === safeInstances[i]) {
          return false;
        }
      }
      if (o[expandPreventMatchKey] === false) {
        return false;
      }
      return o.toString() === '[object Object]';
    }

    /**
     * Cookie parse from headers of http(s) requests.
     *
     * @param req
     * @returns {{}}
     */

  }, {
    key: 'parseCookies',
    value: function parseCookies(req) {
      var cookies = {};
      if (req.headers.cookie) {
        req.headers.cookie.split(';').forEach(function (cookie) {
          var parts = cookie.split('=');
          cookies[parts[0].trim()] = (parts[1] || '').trim();
        });
      }
      return cookies;
    }

    /**
     * Collapse this object to an array.
     *
     * @param obj
     * @returns {*}
     */

  }, {
    key: 'collapseObjectToArray',
    value: function collapseObjectToArray(obj) {
      try {
        var keys = Object.keys(obj);
        if (keys.length < 1) {
          return false;
        }
        if (keys[0] !== '0') {
          return false;
        }
        if (keys[keys.length - 1] !== String(keys.length - 1)) {
          return false;
        }

        var arr = [];
        for (var i in keys) {
          var key = keys[i];
          if (String(parseInt(key)) !== key) {
            return false;
          } else {
            arr.push(obj[key]);
          }
        }

        return arr;
      } catch (e) {
        return false;
      }
    }

    /**
     * Unique-ify an array.
     *
     * @param array Array to be uniquefied.
     * @returns {Array} New array.
     */

  }, {
    key: 'arrayUniqueify',
    value: function arrayUniqueify(array) {
      array.filter(function (value, index, self) {
        return self.indexOf(value) === index;
      });

      return array;
    }
  }, {
    key: 'isObject',
    value: function isObject(arg) {
      return (typeof arg === 'undefined' ? 'undefined' : _typeof(arg)) === 'object' && arg !== null;
    }
  }, {
    key: 'objectToString',
    value: function objectToString(o) {
      return Object.prototype.toString.call(o);
    }
  }, {
    key: 'isError',
    value: function isError(e) {
      return Utils.isObject(e) && (Utils.objectToString(e) === '[object Error]' || e instanceof Error);
    }

    /**
     * Remove a directory.
     *
     * @param dir   Directory path.
     */

  }, {
    key: 'removeDirectory',
    value: function removeDirectory(dir) {
      var filesList = void 0;

      // get directory files
      try {
        filesList = _fs2.default.readdirSync(dir);
      } catch (e) {
        return;
      }

      // iterate all folders and files on the directory
      filesList.forEach(function (file) {
        // get full file path
        var filePath = dir + '/' + file;

        // check if it's a file
        if (_fs2.default.statSync(filePath).isFile()) {
          _fs2.default.unlinkSync(filePath);
        } else {
          Utils.removeDirectory(filePath);
        }
      });

      // remove current directory
      _fs2.default.rmdirSync(dir);
    }

    /**
     * Check if the directory exists.
     *
     * @param dir           Directory path.
     * @returns {boolean}   True if exists, false if not or the given path isn't a directory.
     */

  }, {
    key: 'directoryExists',
    value: function directoryExists(dir) {
      try {
        _fs2.default.statSync(dir).isDirectory();
      } catch (er) {
        return false;
      }

      return true;
    }

    /**
     * Check if a file exists.
     *
     * @param path          Path to check.
     * @returns {boolean}   True if the file exists, false otherwise.
     */

  }, {
    key: 'fileExists',
    value: function fileExists(path) {
      try {
        _fs2.default.statSync(path).isFile();
      } catch (error) {
        return false;
      }

      return true;
    }

    /**
     * Create a new directory.
     *
     * @param path Path there the directory must be created.
     */

  }, {
    key: 'createFolder',
    value: function createFolder(path) {
      try {
        _fs2.default.mkdirSync(path);
      } catch (e) {
        if (e.code !== 'EEXIST') {
          throw e;
        }
      }
    }

    /**
     * Copy a file.
     *
     * This only work with files.
     *
     * @param source        Source path.
     * @param destination   Destination path.
     */

  }, {
    key: 'copyFile',
    value: function copyFile(source, destination) {
      _fs2.default.createReadStream(source).pipe(_fs2.default.createWriteStream(destination));
    }

    /**
     * Get this servers external interface.
     *
     * @returns {String} Server external IP or false if not founded.
     */

  }, {
    key: 'getExternalIPAddress',
    value: function getExternalIPAddress() {
      var ifaces = _os2.default.networkInterfaces();
      var ip = false;

      for (var dev in ifaces) {
        ifaces[dev].forEach(function (details) {
          if (details.family === 'IPv4' && details.address !== '127.0.0.1') {
            ip = details.address;
          }
        });
      }

      return ip;
    }

    /**
     * Make a clone of an object.
     *
     * @param obj         Object to be cloned.
     * @returns {Object}  New object reference.
     */

  }, {
    key: 'objClone',
    value: function objClone(obj) {
      return Object.create(Object.getPrototypeOf(obj), Object.getOwnPropertyNames(obj).reduce(function (memo, name) {
        return (memo[name] = Object.getOwnPropertyDescriptor(obj, name)) && memo;
      }, {}));
    }
  }, {
    key: 'stringToHash',
    value: function stringToHash(api, path, object) {
      if (!object) {
        object = api;
      }
      function _index(obj, i) {
        return obj[i];
      }

      return path.split('.').reduce(_index, object);
    }

    /**
     * Parse an IPv6 address.
     *
     * @param address   Address to be parsed.
     * @returns {{host: string, port: Number}}
     */

  }, {
    key: 'parseIPv6URI',
    value: function parseIPv6URI(address) {
      var host = '::1';
      var port = 80;
      var regexp = new RegExp(/\[([0-9a-f:]+)\]:([0-9]{1,5})/);

      // if we have brackets parse them and find a port
      if (address.indexOf('[') > -1 && address.indexOf(']') > -1) {
        // execute the regular expression
        var res = regexp.exec(address);

        // if null this isn't a valid IPv6 address
        if (res === null) {
          throw new Error('failed to parse address');
        }

        host = res[1];
        port = res[2];
      } else {
        host = address;
      }

      return { host: host, port: parseInt(port, 10) };
    }
  }]);

  return Utils;
}();

exports.default = Utils;