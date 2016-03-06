// Enable source map support
import 'source-map-support/register'

// Module Dependencies
import _ from 'lodash';
import path from 'path';
import async from 'async';
import Utils from './utils';

/**
 * Main Stellar entry point class.
 *
 * This makes the system bootstrap, loading and execution all
 * initializers. Each initializer load new features to the
 * engine instance or perform a set of instruction to accomplish
 * a certain goal.
 */
export default class Engine {

  // ---------------------------------------------------------------------------------------------------------- [STATIC]

  static defaultPriorities = {
    load: 100,
    start: 100,
    stop: 100
  };

  /**
   * Normalize initializer priorities.
   *
   * @param initializer Initializer instance.
   */
  static normalizeInitializerPriority(initializer) {
    initializer.loadPriority = initializer.loadPriority || Engine.defaultPriorities.load;
    initializer.startProority = initializer.startProority || Engine.defaultPriorities.start;
    initializer.stopProority = initializer.stopProority || Engine.defaultPriorities.stop;
  }

  /**
   * Order initializers array by their priority.
   *
   * @param collection
   * @returns {Array}
   */
  static flattenOrderedInitializer(collection) {
    var output = [];
    var keys = [];

    for (var key in collection) {
      keys.push(parseInt(key));
    }

    keys.sort((a, b) => a - b);
    keys.forEach(function (key) {
      collection[ key ].forEach(function (d) {
        output.push(d);
      });
    });

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
  static fatalError(api, errors, type) {
    if (errors && !(errors instanceof Array)) {
      errors = [ errors ];
    }

    if (errors) {
      api.log(`Error with initializer step: ${type}`, 'emergency');
      errors.forEach(function (err) {
        api.log(err.stack, 'emergency');
      });
      process.exit(1);
    }
  }

  // ----------------------------------------------------------------------------------------------------------- [CLASS]

  /**
   * API object.
   *
   * @type {{}}
   */
  api = {
    initialized: false,
    shuttingDown: false,
    running: false,
    started: false,

    log: null,

    scope: {}
  };

  /**
   * List with all initializers.
   *
   * @type {{}}
   */
  initializers = {};

  /**
   * Array with the initial initializers.
   *
   * @type {Array}
   */
  initialInitializers = [];

  /**
   * Array with the load initializers.
   *
   * @type {Array}
   */
  loadInitializers = [];

  /**
   * Array with the start initializers.
   *
   * @type {Array}
   */
  startInitializers = [];

  /**
   * Array with the stop initializers.
   *
   * @type {Array}
   */
  stopInitializers = [];

  /**
   * Create a new instance of Stellar Engine.
   *
   * @param scope - Initial scope
   */
  constructor(scope) {
    let self = this;

    // default scope configs
    let defaultScope = {};

    // save the app scope
    self.api.scope = _.merge(scope, defaultScope);

    // save the engine reference for external calls
    self.api._self = self;

    // define a early custom logger
    self.api.log = function (msg, level = 'info') {
      console.log(`[${level}]`, msg);
    };

    // define the available engine commands
    self.api.commands = {
      start: self.start,
      stop: self.stop,
      restart: self.restart
    };
  }

  // ----------------------------------------------------------------------------------------- [STATE MANAGER FUNCTIONS]

  /**
   * Start engine execution.
   */
  start(callback = null) {
    let self = this;

    // print current execution path
    self.api.log(`Current universe "${self.api.scope.rootPath}"`, 'info');

    // start stage0 loading method
    self.stage0(callback);
  }

  /**
   * Stop the Engine execution.
   *
   * @param callback
   */
  stop(callback = null) {
    let self = this;

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

      self.api.log('Shutting down open servers and stopping task processing', 'alert');

      // if this is the second shutdown we need remove the `finalStopInitializer` callback
      if (self.stopInitializers[ (self.stopInitializers.length - 1) ].name === 'finalStopInitializer') {
        self.stopInitializers.pop();
      }

      // add the final callback
      self.stopInitializers.push(function finalStopInitializer(next) {
        self.api.unWatchAllFiles();
        // @todo - clear pids when we implement clustering
        self.api.log('The Stellar has been stopped', 'alert');
        self.api.log('***', 'debug');

        process.nextTick(function () {
          if (callback !== null) {
            callback(null, self.api);
          }
        });

        next();
      });

      // iterate all initializers and stop them
      async.series(self.stopInitializers, function (errors) {
        Engine.fatalError(self.api, errors, 'stop');
      });
    } else if (self.api.shuttingDown === true) {
      // double sigterm; ignore it
    } else {
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
   * @param callback
   */
  restart(callback = null) {
    let self = this;

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

        self.api.log('*** Stellar Restarted ***', 'info');

        // exists a callback
        if (callback !== null) {
          callback(null, self.api);
        }
      })
    }
  }

  // ------------------------------------------------------------------------------------------------ [STAGES FUNCTIONS]

  /**
   * First startup stage.
   *
   * Steps:
   *  - executes the initial initializers;
   *  - call stage1
   *
   * @param callback This callback only are executed at the end of stage2.
   */
  stage0(callback = null) {
    let self = this;

    // we need to load the config first
    [
      path.resolve(__dirname + '/initializers/config.js')
    ].forEach(function (file) {
      // get full file name
      let filename = file.replace(/^.*[\\\/]/, '');

      // get the first part of the file name
      let initializer = filename.split('.')[ 0 ];

      // get the initializer
      self.initializers[ initializer ] = require(file).default;

      // add it to array
      self.initialInitializers.push(function (next) {
        self.initializers[ initializer ].load(self.api, next);
      });
    });

    // stage1 is called at the end of execution of all initial initializers
    self.initialInitializers.push(function () {
      // call stage1
      self.stage1(callback);
    });

    // execute stage0 initializers in series
    async.series(self.initialInitializers, function (error) {
      self.fatalError(self.api, error, 'stage0');
    });
  }

  /**
   * Second startup stage.
   *
   * Steps:
   *  - load all initializers into memory;
   *  - load initializers;
   *  - mark Engine like initialized;
   *  - call stage2.
   *
   * @param callback This callback only is executed at the stage2 end.
   */
  stage1(callback = null) {
    let self = this;

    // ranked object for all stages
    let loadInitializersRankings = {};
    let startInitializersRankings = {};
    let stopInitializersRankings = {};

    // reset initializers arrays
    self.initializers = {};

    // get an array with all initializers
    let initializers_files = Utils.getFiles(__dirname + '/initializers');

    // iterate all files
    for (let key in initializers_files) {
      let f = initializers_files[ key ];

      // get some file useful information
      let file = path.normalize(f);
      let initializer = path.basename(f).split('.')[ 0 ];
      let ext = _.last(file.split('.'));

      // only load files with the `.js` extension
      if (ext !== 'js') {
        continue;
      }

      // get initializer module
      self.initializers[ initializer ] = require(file).default;

      // initializer load function
      let loadFunction = function (next) {
        // check if the initializer have a load function
        if (typeof self.initializers[ initializer ].load === 'function') {
          self.api.log(` > load: ${initializer}`, 'debug');

          // call `load` property
          self.initializers[ initializer ].load(self.api, function (err) {
            self.api.log(`   loaded: ${initializer}`, 'debug');
            next(err);
          });
        } else {
          next();
        }
      };

      // initializer start function
      let startFunction = function (next) {
        // check if the initializer have a start function
        if (typeof self.initializers[ initializer ].start === 'function') {
          self.api.log(` > start: ${initializer}`, 'debug');

          // execute start routine
          self.initializers[ initializer ].start(self.api, function (err) {
            self.api.log(`   started: ${initializer}`, 'debug');
            next(err);
          });
        } else {
          next();
        }
      };

      // initializer stop function
      let stopFunction = function (next) {
        if (typeof  self.initializers[ initializer ].stop === 'function') {
          self.api.log(` > stop: ${initializer}`, 'debug', file);

          self.initializers[ initializer ].stop(self.api, function (err) {
            self.api.log(`   stopped: ${initializer}`, 'debug', file);
            next(err);
          });
        } else {
          next();
        }
      };

      // normalize initializer priorities
      Engine.normalizeInitializerPriority(self.initializers[ initializer ]);
      loadInitializersRankings[ self.initializers[ initializer ].loadPriority ] = loadInitializersRankings[ self.initializers[ initializer ].loadPriority ] || [];
      startInitializersRankings[ self.initializers[ initializer ].startProority ] = startInitializersRankings[ self.initializers[ initializer ].startProority ] || [];
      stopInitializersRankings[ self.initializers[ initializer ].stopProority ] = stopInitializersRankings[ self.initializers[ initializer ].stopProority ] || [];

      // push loader state function to ranked arrays
      loadInitializersRankings[ self.initializers[ initializer ].loadPriority ].push(loadFunction);
      startInitializersRankings[ self.initializers[ initializer ].startProority ].push(startFunction);
      stopInitializersRankings[ self.initializers[ initializer ].stopProority ].push(stopFunction);
    }

    // organize final array to match the initializers priorities
    self.loadInitializers = Engine.flattenOrderedInitializer(loadInitializersRankings);
    self.startInitializers = Engine.flattenOrderedInitializer(startInitializersRankings);
    self.stopInitializers = Engine.flattenOrderedInitializer(stopInitializersRankings);

    // on the end of loading all initializers set engine like initialized
    self.loadInitializers.push(function () {
      // mark engine like initialized
      self.api.initialized = true;

      // call stage2
      self.stage2(callback);
    });

    // start initialization process
    async.series(self.loadInitializers, function (errors) {
      Engine.fatalError(self.api, errors, 'stage0');
    });
  }

  /**
   * Third startup stage.
   *
   * Steps:
   *  - start initializers;
   *  - mark Engine as running.
   *
   *  @param callback
   */
  stage2(callback = null) {
    let self = this;

    self.startInitializers.push(function (next) {
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

    async.series(self.startInitializers, function (err) {
      Engine.fatalError(self.api, err, 'stage2');
    });
  }
}
