// Enable source map support
import 'source-map-support/register'

// Module Dependencies
import Log from 'log';
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
    // default scope configs
    var defaultScope = {
      debug: 'error'
    };

    // save the app scope
    this.api.scope = _.merge(scope, defaultScope);

    // create a log instance
    this.api.log = new Log(this.api.scope.debug);
  }

  /**
   * Start engine execution.
   */
  start() {
    // print current execution path
    this.api.log.info(`Current universe "${this.api.scope.rootPath}"`);

    // start stage0 loading method
    this.stage0();
  }

  stage0() {
    var self = this;

    // add a shutdown function to the API
    // @todo this should perform a proper initializers shutdown
    this.api.shutdown = function (err = false, msg = '') {
      if (!err) {
        process.exit(0);
      } else {
        // print the error message
        self.api.log.emergency(msg);

        // end engine execution
        process.exit(-1);
      }
    };

    // reset config stage0 initializers
    this.stage0Initialisers = [];

    // we need to load the config first
    [
      path.resolve(__dirname + '/initializers/config.js')
    ].forEach(function (file) {
      var filename = file.replace(/^.*[\\\/]/, '');
      var initializer = filename.split('.')[0];
      self.initializers[initializer] = require(file).default;
      self.stage0Initialisers.push(function (next) {
        self.initializers[initializer].load(self.api, next);
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
      errors = [errors];
    }

    if (errors) {
      api.log.emergency(`Error with initializer step: ${type}`);
      errors.forEach(function (err) {
        api.log.emergency(err.stack);
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
      var initializer = path.basename(f).split('.')[0];
      var ext = _.last(file.split('.'));

      // only load files with the `.js` extension
      if (ext !== 'js') {
        return;
      }

      // require initializer instance
      self.initializers[initializer] = require(file).default;

      // create a new load function for current initializer
      let loadFunction = function (next) {
        // check if the initializer have a load function
        if (typeof self.initializers[initializer].load === 'function') {
          self.api.log.debug(`loading initializer: ${initializer}`);

          // call `load` property
          self.initializers[initializer].load(self.api, function (err) {
            self.api.log.debug(`loaded initializer: ${initializer}`);
            next(err);
          });
        } else {
          next();
        }
      };

      // create a new start function for current initializer
      let startFunction = function (next) {
        // check if the initializer have a start function
        if (typeof self.initializers[initializer].start === 'function') {
          self.api.log.debug(`starting initializer: ${initializer}`);

          // execute start routine
          self.initializers[initializer].start(self.api, function (err) {
            self.api.log.debug(`started initializer: ${initializer}`);
            next(err);
          });
        } else {
          next();
        }
      };

      // normalize initializer priorities
      Engine.normalizeInitializerPriority(self.initializers[initializer]);
      loadInitializersRankings[self.initializers[initializer].loadPriority] = loadInitializersRankings[self.initializers[initializer].loadPriority] || [];
      startInitializersRankings[self.initializers[initializer].startProority] = startInitializersRankings[self.initializers[initializer].startProority] || [];

      // push loader state function to ranked arrays
      loadInitializersRankings[self.initializers[initializer].loadPriority].push(loadFunction);
      startInitializersRankings[self.initializers[initializer].startProority].push(startFunction);
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
      throw new Error('The initializers needs to be loaded frist.');
    }

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
      collection[key].forEach(function (d) {
        output.push(d);
      });
    });

    return output;
  }
}
