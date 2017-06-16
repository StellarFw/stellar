'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _yargs = require('yargs');

var _cluster = require('cluster');

var _cluster2 = _interopRequireDefault(_cluster);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Setup the server ID.
 *
 * TODO: we can use the args from the engine to avoid using the yargs.
 *
 * This ID, can be configured using:
 * - the 'api.config.general.id' configuration;
 * - '--title' option on the command line;
 * - 'STELLAR_TITLE' environment variable;
 * - or one can be generated automatically using the external server IP.
 */
exports.default = class {
  constructor() {
    this.loadPriority = 100;
    this.startPriority = 2;
  }

  /**
   * Load priority.
   *
   * @type {number}
   */


  /**
   * Start priority.
   *
   * @type {number}
   */


  /**
   * Initializer load functions.
   *
   * @param api   API reference.
   * @param next  Callback.
   */
  load(api, next) {
    if (_yargs.argv.title) {
      api.id = _yargs.argv.title;
    } else if (process.env.STELLAR_TITLE) {
      api.id = process.env.STELLAR_TITLE;
    } else if (!api.config.general.id) {
      // get servers external IP
      let externalIP = api.utils.getExternalIPAddress();

      if (externalIP === false) {
        let message = ' * Error fetching this host external IP address; setting id base to \'stellar\'';

        try {
          api.log(message, 'crit');
        } catch (e) {
          console.log(message);
        }
      }

      api.id = externalIP;
      if (_cluster2.default.isWorker) {
        api.id += `:${process.pid}`;
      }
    } else {
      api.id = api.config.general.id;
    }

    // save Stellar version
    api.stellarVersion = require(`../../package.json`).version;

    // finish the initializer load
    next();
  }

  /**
   * Initializer start function.
   *
   * @param api   API reference.
   * @param next  Callback.
   */
  start(api, next) {
    // print out the server ID
    api.log(`server ID: ${api.id}`, 'notice');

    // finish the initializer start
    next();
  }

};