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

  static defaultPriorities = {
    load: 100,
    start: 100,
    stop: 100
  };

  /**
   * API object.
   *
   * @type {{}}
   */
  api = {
    initialized: false,
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
   * Array with the stage0 initializers.
   *
   * This initializers are loaded first and the others.
   *
   * @type {Array}
   */
  stage0Initialisers = [];

  loadInitializers = [];
  startInitializers = [];

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

  stop() {
    console.log("TODO - Engine::stop");
  }

  restart() {
    console.log("TODO - Engine::restart");
  }

  /**
   * Start engine execution.
   */
  start() {
    // print current execution path
    this.api.log(`Current universe "${this.api.scope.rootPath}"`, 'info');

    // start stage0 loading method
    this.stage0();
  }

  stage0() {
    var self = this;

    // add a shutdown function to the API
    // @todo this should perform a proper initializers shutdown
    /*this.api.shutdown = function (err = false, msg = '') {
     if (!err) {
     process.exit(0);
     } else {
     // print the error message
     self.api.log(msg, 'emergency');

     // end engine execution
     process.exit(-1);
     }
     };*/

    // reset config stage0 initializers
    this.stage0Initialisers = [];

    // we need to load the config first
    [
      path.resolve(__dirname + '/initializers/config.js')
    ].forEach(function (file) {
      var filename = file.replace(/^.*[\\\/]/, '');
      var initializer = filename.split('.')[ 0 ];
      self.initializers[ initializer ] = require(file).default;
      self.stage0Initialisers.push(function (next) {
        self.initializers[ initializer ].load(self.api, next);
      });
    });

    // add stage1 function at the end of stage0 initializer cycle
    this.stage0Initialisers.push(function () {
      self.stage1();
    });

    // execute stage0 initializers in series
    async.series(this.stage0Initialisers, function (error) {
      this.fatalError(self.api, error, 'stage0');
    });
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

  /**
   * @todo
   */
  stage1() {
    var self = this;

    // ranked object for all stages
    var loadInitializersRankings = {};
    var startInitializersRankings = {};

    // reset initializers arrays
    this.initializers = {};

    // get all initializers
    var initializers_files = Utils.getFiles(__dirname + '/initializers');

    // iterate all files
    _.forEach(initializers_files, function (f) {
      // get some file useful information
      var file = path.normalize(f);
      var initializer = path.basename(f).split('.')[ 0 ];
      var ext = _.last(file.split('.'));

      // only load files with the `.js` extension
      if (ext !== 'js') {
        return;
      }

      // require initializer instance
      self.initializers[ initializer ] = require(file).default;

      // create a new load function for current initializer
      let loadFunction = function (next) {
        // check if the initializer have a load function
        if (typeof self.initializers[ initializer ].load === 'function') {
          self.api.log(`loading initializer: ${initializer}`, 'debug');

          // call `load` property
          self.initializers[ initializer ].load(self.api, function (err) {
            self.api.log(`loaded initializer: ${initializer}`, 'debug');
            next(err);
          });
        } else {
          next();
        }
      };

      // create a new start function for current initializer
      let startFunction = function (next) {
        // check if the initializer have a start function
        if (typeof self.initializers[ initializer ].start === 'function') {
          self.api.log(`starting initializer: ${initializer}`, 'debug');

          // execute start routine
          self.initializers[ initializer ].start(self.api, function (err) {
            self.api.log(`started initializer: ${initializer}`, 'debug');
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

      // push loader state function to ranked arrays
      loadInitializersRankings[ self.initializers[ initializer ].loadPriority ].push(loadFunction);
      startInitializersRankings[ self.initializers[ initializer ].startProority ].push(startFunction);
    });

    // organize final array to match the initializers priorities
    this.loadInitializers = Engine.flattenOrderedInitializer(loadInitializersRankings);
    this.startInitializers = Engine.flattenOrderedInitializer(startInitializersRankings);

    // on the end of loading all initializers set engine like initialized
    this.loadInitializers.push(function () {
      process.nextTick(function () {
        // mark engine like initialized
        self.api.initialized = true;

        // call stage2
        self.stage2();
      });
    });

    // start initialization process
    async.series(this.loadInitializers, function (errors) {
      Engine.fatalError(self, errors, 'stage0');
    });
  }

  /**
   * Start initializers.
   */
  stage2() {
    var self = this;

    if (this.api.initialized !== true) {
      throw new Error('The initializers needs to be loaded first.');
    }

    this.startInitializers.push(function (next) {
      // define Stellar like running
      self.api.running = true;

      self.api.bootTime = new Date().getTime();
      self.api.log('** Server Started @ ' + new Date() + ' ***', 'notice');
      next();
    });

    async.series(this.startInitializers, function (err) {
      Engine.fatalError(self, err, 'stage2');
    });
  }

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
}
