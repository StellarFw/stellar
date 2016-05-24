import path from 'path';
import {argv} from 'yargs';
import cluster from 'cluster';
import Utils from  '../utils';

/**
 * Setup the server ID.
 *
 * This ID, can be configured using:
 * - the 'api.config.general.id' configuration;
 * - '--title' option on the command line;
 * - 'STELLAR_TITLE' environment variable;
 * - or one can be generated automatically using the external server IP.
 */
export default class {

  /**
   * Load priority.
   *
   * @type {number}
   */
  static loadPriority = 100;

  /**
   * Start priority.
   *
   * @type {number}
   */
  static startPriority = 2;

  /**
   * Initializer load functions.
   *
   * @param api   API reference.
   * @param next  Callback.
   */
  static load (api, next) {
    if (argv.title) {
      api.id = argv.title;
    } else if (process.env.STELLAR_TITLE) {
      api.id = process.env.STELLAR_TITLE;
    } else if (!api.config.general.id) {
      // get servers external IP
      let externalIP = Utils.getExternalIPAddress();

      if (externalIP === false) {
        let message = ' * Error fetching this host external IP address; setting id base to \'stellar\'';

        try {
          api.log(message, 'crit');
        } catch (e) {
          console.log(message);
        }
      }

      api.id = externalIP;
      if (cluster.isWorker) {
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
  static start (api, next) {
    // print out the server ID
    api.log(`server ID: ${api.id}`, 'notice');

    // finish the initializer start
    next();
  }

}
