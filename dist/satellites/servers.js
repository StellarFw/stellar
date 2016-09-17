'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); // module dependencies


var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _async = require('async');

var _async2 = _interopRequireDefault(_async);

var _utils = require('../utils');

var _utils2 = _interopRequireDefault(_utils);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Manager for server instances.
 */
var Servers = function () {

  /**
   * Class constructor.
   *
   * @param api engine api instance.
   */


  /**
   * Engine API instance.
   * @type {null}
   */
  function Servers(api) {
    _classCallCheck(this, Servers);

    this.api = null;
    this.servers = {};

    this.api = api;
  }

  /**
   * Load all servers.
   *
   * @param next  Callback function.
   */


  /**
   * Array with all running server instances.
   *
   * @type {{}}
   */


  _createClass(Servers, [{
    key: 'loadServers',
    value: function loadServers(next) {
      var self = this;
      var jobs = [];

      // get the list of servers to load
      var serversFiles = _utils2.default.getFiles(_path2.default.resolve(__dirname + '/../servers'));

      var _loop = function _loop(k) {
        // get server filename
        var file = serversFiles[k];
        var parts = file.split(/[\/\\]+/);
        var serverName = parts[parts.length - 1].split('.')[0];

        // only load .js files (in debug we also have .map files)
        if (parts[parts.length - 1].match('\.map$')) {
          return 'continue';
        }

        // get server options if exists
        var options = self.api.config.servers[serverName];

        // only load the server if that was enabled
        if (options && options.enable === true) {
          (function () {
            // get server constructor
            var ServerConstructor = require(file).default;

            // push the new job to the queue
            jobs.push(function (done) {
              // instance the new server
              self.servers[serverName] = new ServerConstructor(self.api, options);

              // log a debug message
              self.api.log('Initialized server: ' + serverName, 'debug');

              // execute the done function
              return done();
            });
          })();
        }
      };

      for (var k in serversFiles) {
        var _ret = _loop(k);

        if (_ret === 'continue') continue;
      }

      // execute all the jobs
      _async2.default.series(jobs, next);
    }

    /**
     * Start all the existing servers.
     *
     * @param next  Callback function.
     */

  }, {
    key: 'startServers',
    value: function startServers(next) {
      var self = this;

      // array with all jobs
      var jobs = [];

      // for each server create a new job
      Object.keys(self.servers).forEach(function (serverName) {
        // get server instance
        var server = self.servers[serverName];

        // only load the server if the server was enabled
        if (server.options.enable === true) {
          (function () {
            var message = 'Starting server: ' + serverName;

            // append the bind IP to log message
            if (self.api.config.servers[serverName].bindIP) {
              message += ' @ ' + self.api.config.servers[serverName].bindIP;
            }

            // append the port to log message
            if (self.api.config.servers[serverName].port) {
              message += ' @ ' + self.api.config.servers[serverName].port;
            }

            // push a new job
            jobs.push(function (done) {
              self.api.log(message, 'notice');
              server.start(function (error) {
                if (error) {
                  return done(error);
                }
                self.api.log('Server started: ' + serverName, 'debug');
                return done();
              });
            });
          })();
        }
      });

      // process all the jobs
      _async2.default.series(jobs, next);
    }

    /**
     * Stop all running servers.
     *
     * @param next  Callback function.
     */

  }, {
    key: 'stopServers',
    value: function stopServers(next) {
      var self = this;

      // array with the jobs to stop all servers
      var jobs = [];

      Object.keys(self.servers).forEach(function (serverName) {
        // get server instance
        var server = self.servers[serverName];

        // check if the server are enable
        if (server && server.options.enable === true || !server) {
          jobs.push(function (done) {
            self.api.log('Stopping server: ' + serverName, 'notice');

            // call the server stop method
            server.stop(function (error) {
              if (error) {
                return done(error);
              }
              self.api.log('Server stopped ' + serverName, 'debug');
              return done();
            });
          });
        }
      });

      // execute all jobs
      _async2.default.series(jobs, next);
    }
  }]);

  return Servers;
}();

var _class = function () {
  function _class() {
    _classCallCheck(this, _class);

    this.loadPriority = 550;
    this.startPriority = 900;
    this.stopPriority = 100;
  }

  /**
   * This should be loaded after all engine
   * loading satellites.
   *
   * @type {number}
   */


  _createClass(_class, [{
    key: 'load',
    value: function load(api, next) {
      // instance the server manager
      api.servers = new Servers(api);

      // load enabled servers
      api.servers.loadServers(next);
    }

    /**
     * Satellite starting function.
     *
     * @param api   API object reference.
     * @param next  Callback function.
     */

  }, {
    key: 'start',
    value: function start(api, next) {
      // start servers
      api.servers.startServers(next);
    }
  }, {
    key: 'stop',
    value: function stop(api, next) {
      // stop servers
      api.servers.stopServers(next);
    }
  }]);

  return _class;
}();

exports.default = _class;