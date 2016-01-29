import fs from 'fs';
import path from 'path';
import {argv} from 'optimist';
import Utils from '../utils';

/**
 * This initializer loads all app configs to the current
 * running instance.
 */
export default class {

  /**
   * Load priority.
   *
   * This initializer needs to be loaded first of all
   * others.
   *
   * @type {number}
   */
  static loadPriority = 0;

  static load(api, next) {
    // define env property
    api.env = 'development';

    if (argv.NODE_ENV) {
      api.env = argv.NODE_ENV;
    } else if (process.env.NODE_ENV) {
      api.env = process.env.NODE_ENV;
    }

    api.loadConfigDirectory = function (configPath) {
      // get all files from the config folder
      let configFiles = Utils.recursiveDirectoryGlob(configPath);

      let loadRetries = 0;
      let loadErrors = {};

      for (let i = 0, limit = configFiles.length; (i < limit); i++) {
        // get the next file to be loaded
        let file = configFiles[ i ];

        try {
          // attempt configuration file load
          let localConfig = require(file);
          if (localConfig.default) {
            api.config = Utils.hashMerge(api.config, localConfig.default, api);
          }
          if (localConfig[ api.env ]) {
            api.config = Utils.hashMerge(api.config, localConfig[ api.env ], api);
          }

          // configuration file load success: clear retries and
          // errors since progress has been made
          loadRetries = 0;
          loadErrors = {};
        } catch (error) {
          // error loading configuration, abort if all remaining
          // configuration files have been tried and failed
          // indicating inability to progress
          loadErrors[ file ] = error.toString();
          if (++loadRetries === limit - i) {
            throw new Error('Unable to load configurations, errors: ' + JSON.stringify(loadErrors));
          }
          // adjust configuration files list: remove and push
          // failed configuration to the end of the list and
          // continue with next file at same index
          configFiles.push(configFiles.splice(i--, 1)[ 0 ]);
        }
      }
    };

    // set config object on API
    api.config = {};

    try {
      // read project manifest
      api.config = require(`${api.scope.rootPath}/manifest.json`);
    } catch (e) {
      // when the project manifest doesn't exists the user is informed
      // and the engine instance is terminated
      api.log('Project `manifest.json` file does not exists.', 'emergency');

      // end the engine execution
      api.shutdown(true, 'manifest not found');
    }

    // load the default config files from the Stellar core
    api.loadConfigDirectory(__dirname + '/../config');

    // load the config files from the current universe if exists
    api.loadConfigDirectory(`${api.scope.rootPath}/config`);

    process.nextTick(next);
  }

  /**
   * Start action.
   *
   * @param api api object.
   * @param next callback function.
   */
  static start(api, next) {
    api.log(`environment: ${api.env}`, 'notice');
    next();
  }

}
