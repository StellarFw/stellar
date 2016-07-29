'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); // Enable source map support


// Module Dependencies


require('source-map-support/register');

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _async = require('async');

var _async2 = _interopRequireDefault(_async);

var _utils = require('./utils');

var _utils2 = _interopRequireDefault(_utils);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Main Stellar entry point class.
 *
 * This makes the system bootstrap, loading and execution all
 * satellites. Each initializer load new features to the
 * engine instance or perform a set of instruction to accomplish
 * a certain goal.
 */

var Engine = function () {
  _createClass(Engine, null, [{
    key: 'normalizeInitializerPriority',


    /**
     * Normalize satellite priorities.
     *
     * @param satellite Satellite instance to be normalized.
     */
    value: function normalizeInitializerPriority(satellite) {
      satellite.loadPriority = satellite.loadPriority || Engine.defaultPriorities.load;
      satellite.startPriority = satellite.startPriority || Engine.defaultPriorities.start;
      satellite.stopPriority = satellite.stopPriority || Engine.defaultPriorities.stop;
    }

    /**
     * Order satellites array by their priority.
     *
     * @param collection  Satellites array to be ordered.
     * @returns {Array}   New ordered array.
     */


    // ---------------------------------------------------------------------------------------------------------- [STATIC]

    /**
     * Default proprieties for the satellites.
     *
     * @type {{load: number, start: number, stop: number}}
     */

  }, {
    key: 'flattenOrderedInitializer',
    value: function flattenOrderedInitializer(collection) {
      var keys = [];
      var output = [];

      // get keys from the collection
      for (var key in collection) {
        keys.push(parseInt(key));
      }

      // sort the keys in ascendant way
      keys.sort(function (a, b) {
        return a - b;
      });

      // iterate the ordered keys and create the new ordered object to be outputted
      keys.forEach(function (key) {
        return collection[key].forEach(function (d) {
          return output.push(d);
        });
      });

      // return the new ordered object
      return output;
    }

    /**
     * Print fatal error on the console and exit from the engine
     * execution.
     *
     * @private
     * @param api     API instance.
     * @param errors  String or array with the fatal error(s).
     * @param type    String with the error type.
     */

  }, {
    key: 'fatalError',
    value: function fatalError(api, errors, type) {
      // if errors variables if not defined return
      if (!errors) {
        return;
      }

      // ensure the errors variable is an instance of Array
      if (!(errors instanceof Array)) {
        errors = [errors];
      }

      // log an emergency message
      api.log('Error with satellite step: ' + type, 'emergency');

      // log all the errors
      errors.forEach(function (err) {
        return api.log(err.stack, 'emergency');
      });

      // finish the process execution
      process.exit(1);
    }

    // ----------------------------------------------------------------------------------------------------------- [Class]

    /**
     * API object.
     *
     * This object will be shared across all the platform, it's here the
     * satellites will load logic and the developers access the functions.
     *
     * @type {{}}
     */


    /**
     * List with all satellites.
     *
     * @type {{}}
     */


    /**
     * Array with the initial satellites.
     *
     * @type {Array}
     */


    /**
     * Array with the load satellites.
     *
     * This array contains all the satellites who has a load method.
     *
     * @type {Array}
     */


    /**
     * Array with the start satellites.
     *
     * This array contains all the satellites who has a start method.
     *
     * @type {Array}
     */


    /**
     * Array with the stop satellites.
     *
     * This array contains all the satellites who has a stop method.
     *
     * @type {Array}
     */

  }]);

  /**
   * Create a new instance of the Engine.
   *
   * @param scope Initial scope
   */

  function Engine(scope) {
    _classCallCheck(this, Engine);

    this.api = {
      initialized: false,
      shuttingDown: false,
      running: false,
      started: false,
      bootTime: null,

      commands: {
        start: null,
        stop: null,
        restart: null
      },

      _self: null,

      log: null,

      scope: {}
    };
    this.satellites = {};
    this.initialSatellites = [];
    this.loadSatellites = [];
    this.startSatellites = [];
    this.stopSatellites = [];

    var self = this;

    // save current execution scope
    self.api.scope = scope;

    // save the engine reference for external calls
    self.api._self = self;

    // define a dummy logger
    //
    // this only should print error, emergency levels
    self.api.log = function (msg) {
      var level = arguments.length <= 1 || arguments[1] === undefined ? 'info' : arguments[1];

      // if we are on test environment don't use the console
      if (process.env.NODE_ENV === 'test') {
        return;
      }

      if (level === 'emergency' || level === 'error') {
        console.log('\u001b[31m[-] ' + msg + '\u001b[37m');
      } else if (level === 'info') {
        console.log('[!] ' + msg);
      }
    };

    // define the available engine commands
    self.api.commands = {
      start: self.start,
      stop: self.stop,
      restart: self.restart
    };
  }

  // ----------------------------------------------------------------------------------------- [State Manager Functions]

  /**
   * Start engine execution.
   *
   * @param callback This function is called when the Engine finish their startup.
   */


  _createClass(Engine, [{
    key: 'start',
    value: function start() {
      var callback = arguments.length <= 0 || arguments[0] === undefined ? null : arguments[0];

      var self = this;

      // if this function has called outside of the Engine the 'this'
      // variable has an invalid reference
      if (this._self) {
        self = this._self;
      }
      self.api._self = self;

      // print current execution path
      self.api.log('Current universe "' + self.api.scope.rootPath + '"', 'info');

      // start stage0 loading method
      self.stage0(callback);
    }

    /**
     * Stop the Engine execution.
     *
     * This method try shutdown the engine in a non violent way, this
     * starts to execute all the stop method on the supported satellites.
     *
     * @param callback Callback function to be executed at the stop end execution.
     */

  }, {
    key: 'stop',
    value: function stop() {
      var callback = arguments.length <= 0 || arguments[0] === undefined ? null : arguments[0];

      var self = this;

      // if this function has called outside of the Engine the 'this'
      // variable has an invalid reference
      if (this._self) {
        self = this._self;
      }

      if (self.api.running === true) {
        // stop Engine
        self.api.shuttingDown = true;
        self.api.running = false;
        self.api.initialized = false;

        // log a shutting down message
        self.api.log('Shutting down open servers and stopping task processing', 'alert');

        // if this is the second shutdown we need remove the `finalStopInitializer` callback
        if (self.stopSatellites[self.stopSatellites.length - 1].name === 'finalStopInitializer') {
          self.stopSatellites.pop();
        }

        // add the final callback
        self.stopSatellites.push(function finalStopInitializer(next) {
          // stop watch for file changes
          self.api.configs.unwatchAllFiles();

          // clear cluster PIDs
          self.api.pids.clearPidFile();

          // log a shutdown message
          self.api.log('Stellar has been stopped', 'alert');
          self.api.log('***', 'debug');

          // execute the callback on the next tick
          process.nextTick(function () {
            if (callback !== null) {
              callback(null, self.api);
            }
          });

          // async callback
          next();
        });

        // iterate all satellites and stop them
        _async2.default.series(self.stopSatellites, function (errors) {
          return Engine.fatalError(self.api, errors, 'stop');
        });
      } else if (self.api.shuttingDown === true) {
        // double sigterm; ignore it
      } else {
        // we can shutdown the Engine if it is not running
        self.api.log('Cannot shutdown Stellar, not running', 'error');

        // exists a callback?
        if (callback !== null) {
          callback(null, self.api);
        }
      }
    }

    /**
     * Restart the Stellar Engine.
     *
     * This execute a stop action and execute the stage2 load actions.
     *
     * @param callback Callback function to be executed at the restart end.s
     */

  }, {
    key: 'restart',
    value: function restart() {
      var callback = arguments.length <= 0 || arguments[0] === undefined ? null : arguments[0];

      var self = this;

      // if this function has called outside of the Engine the 'this'
      // variable has an invalid reference
      if (this._self) {
        self = this._self;
      }

      if (self.api.running === true) {
        // stop the engine
        self.stop(function (err) {
          // log error if present
          if (err) {
            self.api.log(err, 'error');
          }

          // start the engine again
          self.stage2(function (err) {
            if (err) {
              self.api.log(err, 'error');
            }

            // log a restart message
            self.api.log('*** Stellar Restarted ***', 'info');

            // exists a callback
            if (callback !== null) {
              callback(null, self.api);
            }
          });
        });
      } else {
        self.stage2(function (err) {
          // log any encountered error
          if (err) {
            self.api.log(err, 'error');
          }

          // log a restart message
          self.api.log('*** Stellar Restarted ***', 'info');

          // exists a callback
          if (callback !== null) {
            callback(null, self.api);
          }
        });
      }
    }

    // ------------------------------------------------------------------------------------------------ [States Functions]

    /**
     * First startup stage.
     *
     * Steps:
     *  - executes the initial satellites;
     *  - call stage1
     *
     * @param callback This callback only are executed at the end of stage2.
     */

  }, {
    key: 'stage0',
    value: function stage0() {
      var callback = arguments.length <= 0 || arguments[0] === undefined ? null : arguments[0];

      var self = this;

      // we need to load the config first
      var initialSatellites = [_path2.default.resolve(__dirname + '/satellites/config.js')];
      initialSatellites.forEach(function (file) {
        // get full file name
        var filename = file.replace(/^.*[\\\/]/, '');

        // get the first part of the file name
        var initializer = filename.split('.')[0];

        // get the initializer
        self.satellites[initializer] = new (require(file).default)();

        // add it to array
        self.initialSatellites.push(function (next) {
          return self.satellites[initializer].load(self.api, next);
        });
      });

      // stage1 is called at the end of execution of all initial satellites
      self.initialSatellites.push(function () {
        return self.stage1(callback);
      });

      // execute stage0 satellites in series
      _async2.default.series(self.initialSatellites, function (error) {
        return Engine.fatalError(self.api, error, 'stage0');
      });
    }

    /**
     * Second startup stage.
     *
     * Steps:
     *  - load all satellites into memory;
     *  - load satellites;
     *  - mark Engine like initialized;
     *  - call stage2.
     *
     * @param callback This callback only is executed at the stage2 end.
     */

  }, {
    key: 'stage1',
    value: function stage1() {
      var callback = arguments.length <= 0 || arguments[0] === undefined ? null : arguments[0];

      var self = this;

      // ranked object for all stages
      var loadSatellitesRankings = {};
      var startSatellitesRankings = {};
      var stopSatellitesRankings = {};

      // reset satellites arrays
      self.satellites = {};

      // function to load the satellites in the right place
      var loadSatellitesInPlace = function loadSatellitesInPlace(satellitesFiles) {
        var _loop = function _loop(key) {
          var f = satellitesFiles[key];

          // get satellite normalized file name and
          var file = _path2.default.normalize(f);
          var initializer = _path2.default.basename(f).split('.')[0];
          var ext = _lodash2.default.last(file.split('.'));

          // only load files with the `.js` extension
          if (ext !== 'js') {
            return 'continue';
          }

          // get initializer module and instantiate it
          self.satellites[initializer] = new (require(file).default)();

          // initializer load function
          var loadFunction = function loadFunction(next) {
            // check if the initializer have a load function
            if (typeof self.satellites[initializer].load === 'function') {
              self.api.log(' > load: ' + initializer, 'debug');

              // call `load` property
              self.satellites[initializer].load(self.api, function (err) {
                self.api.log('   loaded: ' + initializer, 'debug');
                next(err);
              });
            } else {
              next();
            }
          };

          // initializer start function
          var startFunction = function startFunction(next) {
            // check if the initializer have a start function
            if (typeof self.satellites[initializer].start === 'function') {
              self.api.log(' > start: ' + initializer, 'debug');

              // execute start routine
              self.satellites[initializer].start(self.api, function (err) {
                self.api.log('   started: ' + initializer, 'debug');
                next(err);
              });
            } else {
              next();
            }
          };

          // initializer stop function
          var stopFunction = function stopFunction(next) {
            if (typeof self.satellites[initializer].stop === 'function') {
              self.api.log(' > stop: ' + initializer, 'debug');

              self.satellites[initializer].stop(self.api, function (err) {
                self.api.log('   stopped: ' + initializer, 'debug');
                next(err);
              });
            } else {
              next();
            }
          };

          // normalize satellite priorities
          Engine.normalizeInitializerPriority(self.satellites[initializer]);
          loadSatellitesRankings[self.satellites[initializer].loadPriority] = loadSatellitesRankings[self.satellites[initializer].loadPriority] || [];
          startSatellitesRankings[self.satellites[initializer].startPriority] = startSatellitesRankings[self.satellites[initializer].startPriority] || [];
          stopSatellitesRankings[self.satellites[initializer].stopPriority] = stopSatellitesRankings[self.satellites[initializer].stopPriority] || [];

          // push loader state function to ranked arrays
          loadSatellitesRankings[self.satellites[initializer].loadPriority].push(loadFunction);
          startSatellitesRankings[self.satellites[initializer].startPriority].push(startFunction);
          stopSatellitesRankings[self.satellites[initializer].stopPriority].push(stopFunction);
        };

        // iterate all files
        for (var key in satellitesFiles) {
          var _ret = _loop(key);

          if (_ret === 'continue') continue;
        }
      };

      // get an array with all satellites
      loadSatellitesInPlace(_utils2.default.getFiles(__dirname + '/satellites'));

      // load satellites from all the active modules
      self.api.config.modules.forEach(function (moduleName) {
        // build the full path to the satellites folder
        var moduleSatellitePaths = self.api.scope.rootPath + '/modules/' + moduleName + '/satellites';

        // check if the folder exists
        if (_utils2.default.directoryExists(moduleSatellitePaths)) {
          loadSatellitesInPlace(_utils2.default.getFiles(moduleSatellitePaths));
        }
      });

      // organize final array to match the satellites priorities
      self.loadSatellites = Engine.flattenOrderedInitializer(loadSatellitesRankings);
      self.startSatellites = Engine.flattenOrderedInitializer(startSatellitesRankings);
      self.stopSatellites = Engine.flattenOrderedInitializer(stopSatellitesRankings);

      // on the end of loading all satellites set engine like initialized
      self.loadSatellites.push(function () {
        // mark engine like initialized
        self.api.initialized = true;

        // call stage2
        self.stage2(callback);
      });

      // start initialization process
      _async2.default.series(self.loadSatellites, function (errors) {
        return Engine.fatalError(self.api, errors, 'stage0');
      });
    }

    /**
     * Third startup stage.
     *
     * Steps:
     *  - start satellites;
     *  - mark Engine as running.
     *
     *  @param callback
     */

  }, {
    key: 'stage2',
    value: function stage2() {
      var callback = arguments.length <= 0 || arguments[0] === undefined ? null : arguments[0];

      var self = this;

      self.startSatellites.push(function (next) {
        // define Stellar like running
        self.api.running = true;

        self.api.bootTime = new Date().getTime();
        self.api.log('** Server Started @ ' + new Date() + ' ***', 'notice');

        // call the callback if it's present
        if (callback !== null) {
          callback(null, self.api);
        }

        next();
      });

      _async2.default.series(self.startSatellites, function (err) {
        return Engine.fatalError(self.api, err, 'stage2');
      });
    }
  }]);

  return Engine;
}();

Engine.defaultPriorities = {
  load: 100,
  start: 100,
  stop: 100
};
exports.default = Engine;
//# sourceMappingURL=engine.js.map
