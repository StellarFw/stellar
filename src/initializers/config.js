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

    // implement a system to watch for file changes
    api.watchedFiles = [];

    api.watchFileAndAct = function (file, callback) {
      // normalise file path
      file = path.normalize(file);

      // check if file exists
      if (!fs.existsSync(file)) {
        throw new Error(`${file} does not exist, and cannot be watched`);
      }

      // the watch for files change only works on development mode
      if (api.config.general.developmentMode === true && api.watchedFiles.indexOf(file) < 0) {
        api.watchedFiles.push(file);
        fs.watchFile(file, {interval: 1000}, (curr, prev) => {
          if (curr.mtime > prev.mtime && api.config.general.developmentMode === true) {
            process.nextTick(function () {
              let cleanPath = file;
              if (process.platform === 'win32') {
                cleanPath = file.replace(/\//g, '\\');
              }

              // remove file from require cache
              delete require.cache[ require.resolve(cleanPath) ];
              callback(file);
            });
          }
        });
      }
    };

    if (argv.NODE_ENV) {
      api.env = argv.NODE_ENV;
    } else if (process.env.NODE_ENV) {
      api.env = process.env.NODE_ENV;
    }

    /**
     * Reboot handler.
     *
     * This is executed when a config file is changed.
     *
     * @param file
     */
    let rebootCallback = function(file){
      api.log('\r\n\r\n*** rebooting due to config change (' + file + ') ***\r\n\r\n', 'info');
      delete require.cache[require.resolve(file)];
      api.commands.restart.call(api._self);
    };

    api.loadConfigDirectory = function (configPath, watch = false) {
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

          // configuration file load success: clear retries and errors since progress has been made
          loadRetries = 0;
          loadErrors = {};

          if (watch !== false) {
            // configuration file loaded: set watch
            api.watchFileAndAct(file, rebootCallback);
          }
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
    // the platform should be reloaded when the project configs changes
    api.loadConfigDirectory(`${api.scope.rootPath}/config`, true);

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
