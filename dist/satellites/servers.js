'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _async = require('async');

var _async2 = _interopRequireDefault(_async);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Manager for server instances.
 */
// module dependencies
class Servers {

  /**
   * Class constructor.
   *
   * @param api engine api instance.
   */

  /**
   * Engine API instance.
   * @type {null}
   */
  constructor(api) {
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
  loadServers(next) {
    let self = this;
    let jobs = [];

    // get the list of servers to load
    let serversFiles = this.api.utils.getFiles(_path2.default.resolve(`${__dirname}/../servers`));

    for (let k in serversFiles) {
      // get server filename
      let file = serversFiles[k];
      let parts = file.split(/[\/\\]+/);
      let serverName = parts[parts.length - 1].split('.')[0];

      // only load .js files (in debug we also have .map files)
      if (parts[parts.length - 1].match('\.map$')) {
        continue;
      }

      // get server options if exists
      let options = self.api.config.servers[serverName];

      // only load the server if that was enabled
      if (options && options.enable === true) {
        // get server constructor
        let ServerConstructor = require(file).default;

        // push the new job to the queue
        jobs.push(done => {
          // instance the new server
          self.servers[serverName] = new ServerConstructor(self.api, options);

          // log a debug message
          self.api.log(`Initialized server: ${serverName}`, 'debug'

          // execute the done function
          );return done();
        });
      }
    }

    // execute all the jobs
    _async2.default.series(jobs, next);
  }

  /**
   * Start all the existing servers.
   *
   * @param next  Callback function.
   */
  startServers(next) {
    let self = this;

    // array with all jobs
    let jobs = [];

    // for each server create a new job
    Object.keys(self.servers).forEach(serverName => {
      // get server instance
      let server = self.servers[serverName];

      // only load the server if the server was enabled
      if (server.options.enable === true) {
        let message = `Starting server: ${serverName}`;

        // append the bind IP to log message
        if (self.api.config.servers[serverName].bindIP) {
          message += ` @ ${self.api.config.servers[serverName].bindIP}`;
        }

        // append the port to log message
        if (self.api.config.servers[serverName].port) {
          message += ` @ ${self.api.config.servers[serverName].port}`;
        }

        // push a new job
        jobs.push(done => {
          self.api.log(message, 'notice');
          server.start(error => {
            if (error) {
              return done(error);
            }
            self.api.log(`Server started: ${serverName}`, 'debug');
            return done();
          });
        });
      }
    }

    // process all the jobs
    );_async2.default.series(jobs, next);
  }

  /**
   * Stop all running servers.
   *
   * @param next  Callback function.
   */
  stopServers(next) {
    let self = this;

    // array with the jobs to stop all servers
    let jobs = [];

    Object.keys(self.servers).forEach(serverName => {
      // get server instance
      let server = self.servers[serverName];

      // check if the server are enable
      if (server && server.options.enable === true || !server) {
        jobs.push(done => {
          self.api.log(`Stopping server: ${serverName}`, 'notice'

          // call the server stop method
          );server.stop(error => {
            if (error) {
              return done(error);
            }
            self.api.log(`Server stopped ${serverName}`, 'debug');
            return done();
          });
        });
      }
    }

    // execute all jobs
    );_async2.default.series(jobs, next);
  }
}

exports.default = class {
  constructor() {
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


  load(api, next) {
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
  start(api, next) {
    // start servers
    api.servers.startServers(next);
  }

  stop(api, next) {
    // stop servers
    api.servers.stopServers(next);
  }
};