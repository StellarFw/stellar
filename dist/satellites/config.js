'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _utils = require('../utils');

var _utils2 = _interopRequireDefault(_utils);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var ConfigManager = function () {

  /**
   * Create a new instance of the ConfigManager.
   *
   * @param api API reference object.
   */


  /**
   * Api reference object.
   *
   * @type {null}
   */

  function ConfigManager(api) {
    _classCallCheck(this, ConfigManager);

    this.api = null;
    this._watchedFiles = [];
    this.api = api;
  }

  /**
   * Start the config execution.
   */


  /**
   * Files to watch for changes.
   *
   * @type {Array}
   * @private
   */


  _createClass(ConfigManager, [{
    key: 'execute',
    value: function execute(next) {
      // init the execution environment
      this._setupEnvironment();

      // creates 'temp' folder if it does not exist
      this._createTempFolder();

      // load manifest file, and core, project and modules configs
      this._loadConfigs();

      // finish the config execution on the next tick
      process.nextTick(next);
    }

    /**
     * Setup the execution  environment.
     *
     * This define what environment should be used.
     *
     * TODO: use the command line arguments to define the environment
     */

  }, {
    key: '_setupEnvironment',
    value: function _setupEnvironment() {
      var self = this;

      // if (argv.NODE_ENV) {
      //   self.api.env = argv.NODE_ENV
      // } else
      if (process.env.NODE_ENV) {
        self.api.env = process.env.NODE_ENV;
      } else {
        self.api.env = 'development';
      }
    }

    /**
     * Unwatch all files.
     */

  }, {
    key: 'unwatchAllFiles',
    value: function unwatchAllFiles() {
      var self = this;

      // iterate all watched files and say to the FS to stop watch the changes
      for (var i in self._watchedFiles) {
        _fs2.default.unwatchFile(self._watchedFiles[i]);
      }

      // reset the watch array
      self._watchedFiles = [];
    }

    /**
     * Start watching for changes on a file and set a function to be executed
     * on the file change.
     *
     * @param file      File path
     * @param callback  Callback function.
     */

  }, {
    key: 'watchFileAndAct',
    value: function watchFileAndAct(file, callback) {
      var self = this;

      // normalise file path
      file = _path2.default.normalize(file);

      // check if file exists
      if (!_fs2.default.existsSync(file)) {
        throw new Error(file + ' does not exist, and cannot be watched');
      }

      // the watch for files change only works on development mode
      if (self.api.config.general.developmentMode !== true || self._watchedFiles.indexOf(file) > 0) {
        return;
      }

      // push the new file to the array of watched files
      self._watchedFiles.push(file);

      // say to the FS to start watching for changes in this file with an interval of 1 seconds
      _fs2.default.watchFile(file, { interval: 1000 }, function (curr, prev) {
        if (curr.mtime > prev.mtime && self.api.config.general.developmentMode === true) {
          process.nextTick(function () {
            var cleanPath = file;

            // we need to replace the '/' by '\'
            if (process.platform === 'win32') {
              cleanPath = file.replace(/\//g, '\\');
            }

            // remove file from require cache to force reload the file
            delete require.cache[require.resolve(cleanPath)];

            // execute the callback function
            callback(file);
          });
        }
      });
    }

    /**
     * Reboot handler.
     *
     * This is executed when a config file is changed.
     *
     * @param file  File path who as changed.
     * @private
     */

  }, {
    key: '_rebootCallback',
    value: function _rebootCallback(file) {
      var self = this;

      self.api.log('\r\n\r\n*** rebooting due to config change (' + file + ') ***\r\n\r\n', 'info');
      delete require.cache[require.resolve(file)];
      self.api.commands.restart.call(self.api._self);
    }
  }, {
    key: '_loadConfigs',
    value: function _loadConfigs() {
      var self = this;

      // set config object on API
      self.api.config = {};

      try {
        // read project manifest
        self.api.config = require(self.api.scope.rootPath + '/manifest.json');
      } catch (e) {
        // when the project manifest doesn't exists the user is informed
        // and the engine instance is terminated
        self.api.log('Project `manifest.json` file does not exists.', 'emergency');

        // finish process (we can not stop the Engine because it can not be run)
        process.exit(1);
      }

      // load the default config files from the Stellar core
      self.loadConfigDirectory(__dirname + '/../config');

      // load all the configs from the modules
      self.api.config.modules.forEach(function (moduleName) {
        return self.loadConfigDirectory(self.api.scope.rootPath + '/modules/' + moduleName + '/config', true);
      });

      // load the config files from the current universe if exists
      // the platform should be reloaded when the project configs changes
      self.loadConfigDirectory(self.api.scope.rootPath + '/config', true);
    }

    /**
     * Load a directory as a config repository.
     *
     * @param configPath
     * @param watch
     */

  }, {
    key: 'loadConfigDirectory',
    value: function loadConfigDirectory(configPath) {
      var watch = arguments.length <= 1 || arguments[1] === undefined ? false : arguments[1];

      var self = this;

      // get all files from the config folder
      var configFiles = _utils2.default.recursiveDirectoryGlob(configPath);

      var loadRetries = 0;
      var loadErrors = {};

      for (var i = 0, limit = configFiles.length; i < limit; i++) {
        // get the next file to be loaded
        var file = configFiles[i];

        try {
          // attempt configuration file load
          var localConfig = require(file);
          if (localConfig.default) {
            self.api.config = _utils2.default.hashMerge(self.api.config, localConfig.default, self.api);
          }
          if (localConfig[self.api.env]) {
            self.api.config = _utils2.default.hashMerge(self.api.config, localConfig[self.api.env], self.api);
          }

          // configuration file load success: clear retries and errors since progress
          // has been made
          loadRetries = 0;
          loadErrors = {};

          // configuration file loaded: set watch
          if (watch !== false) {
            self.watchFileAndAct(file, self._rebootCallback.bind(self));
          }
        } catch (error) {
          // error loading configuration, abort if all remaining configuration files
          // have been tried and failed indicating inability to progress
          loadErrors[file] = error.toString();
          if (++loadRetries === limit - i) {
            throw new Error('Unable to load configurations, errors: ' + JSON.stringify(loadErrors));
          }
          // adjust configuration files list: remove and push failed configuration to
          // the end of the list and continue with next file at same index
          configFiles.push(configFiles.splice(i--, 1)[0]);
        }
      }
    }

    /**
     * Creates the 'temp' folder if it does not exist.
     *
     * This folder is used to store the log files.
     *
     * @private
     */

  }, {
    key: '_createTempFolder',
    value: function _createTempFolder() {
      var self = this;

      if (!_utils2.default.directoryExists(self.api.scope.rootPath + '/temp')) {
        _utils2.default.createFolder(self.api.scope.rootPath + '/temp');
      }
    }
  }]);

  return ConfigManager;
}();

/**
 * This initializer loads all app configs to the current running instance.
 */


var _class = function () {
  function _class() {
    _classCallCheck(this, _class);

    this.loadPriority = 0;
  }

  /**
   * Load priority.
   *
   * This initializer needs to be loaded first of all
   * others.
   *
   * @type {number}
   */


  _createClass(_class, [{
    key: 'load',


    /**
     * Load satellite function.
     *
     * @param api   API object reference.
     * @param next  Callback function.
     */
    value: function load(api, next) {
      // put the config instance available on the API object
      api.configs = new ConfigManager(api);

      // start the config manager execution
      api.configs.execute(next);
    }

    /**
     * Start satellite function.
     *
     * @param api   Api object reference.
     * @param next  Callback function.
     */

  }, {
    key: 'start',
    value: function start(api, next) {
      // print out the current environment
      api.log('environment: ' + api.env, 'notice');

      // finish the satellite start
      next();
    }
  }]);

  return _class;
}();

exports.default = _class;
//# sourceMappingURL=config.js.map
