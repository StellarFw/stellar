/**
 * Module dependencies.
 */

var _       = require('lodash');
var path    = require('path');
var events  = require('events');
var Log     = require('log');
var Actions = require('./actions');
var Utils   = require('./utils');
var async   = require('async');

// ---------------------------------------------------------------------------- [PRIVATE]

/**
 * Default priorities for initializers.
 *
 * @type {Object}
 */
var defaultPriorities = {
  load: 100,
  start: 100,
  stop: 100
};

var sortNumber = function(a,b) {
    return a - b;
};

var flattenOrderedInitialzer = function(collection){
  var output = [];
  var keys = [];

  for(var key in collection){
    keys.push(parseInt(key));
  }

  keys.sort(sortNumber);
  keys.forEach(function(key){
    collection[key].forEach(function(d){
      output.push(d);
    });
  });

  return output;
};

var fatalError = function(api, errors, type){
  if (errors && !(errors instanceof Array)) { errors = [errors]; }

  if(errors) {
    api.log.emergency(('Error with initializer step: ' + type).red);
    errors.forEach(function(err) {
      api.log.emergency(err.stack.red);
    });
    process.exit(1);
  }
};

/**
 * Normalize initializer priorities.
 *
 * @param  {Object} initializer Initializer instance.
 */
var normalizeInitializerPriority = function (initializer) {
  if (initializer.loadPriority === undefined) { initializer.loadPriority = defaultPriorities.load; }
  if (initializer.startPriority === undefined) { initializer.startPriority = defaultPriorities.start; }
  if (initializer.stopPriority === undefined) { initializer.stopPriority = defaultPriorities.stop; }
};

/**
 * Load initializers to the engine and execute the `load` stage.
 *
 * @todo load stop actions.
 *
 * @param  {Object}   api      Object this all platform sharead functions.
 * @param  {Function} callback Callback function to be executed on the end of
 *                             `load` stage.
 */
var loadInitializers = function(api, callback) {
  var self = this;

  // ranked object for all stages
  var loadInitializerRankings  = {};
  var startInitializerRankings = {};

  // reset initializers arrays
  self.initializers = [];

  // get all initializers
  var initializers_files = Utils.getFiles(__dirname + '/initializers');

  // iterate all files
  _.forEach(initializers_files, function (f) {
    // get some file usefull information
    var file        = path.normalize(f);
    var initializer = path.basename(f).split('.')[0];
    var ext         = _.last(file.split('.'));

    // only load files with the `.js` extension
    if (ext !== 'js') { return; }

    // require initializer instance
    self.initializers[initializer] = require(file);

    // create a new load function for current initializer
    var loadFunction = function (next) {

      // check if the initializer have a load function
      if (typeof self.initializers[initializer].load === 'function') {
        try { api.log.debug(('loading initializer: ' + initializer).white); } catch(e) {}

        // call `load` property
        self.initializers[initializer].load(self.api, function (err) {
          try { api.log.debug(('loaded initializer: ' + initializer).white); } catch(e) { }
          next(err);
        });
      } else {
        next();
      }
    };

    // create a new start function for current initializer
    var startFunction = function (next) {
      // check if the initializer have a start function
      if (typeof self.initializers[initializer].start === 'function') {
        try { api.log.debug(('starting initializer: ' + initializer).white); } catch(e) {}

        // execute start routine
        self.initializers[initializer].start(self.api, function (err) {
          try { api.log.debug(('started initializer: ' + initializer).white); } catch(e) { }
          next(err);
        });
      } else {
        next();
      }
    };

    // normalize initializer priorities
    normalizeInitializerPriority(self.initializers[initializer]);

    if (loadInitializerRankings[ self.initializers[initializer].loadPriority ] === undefined) {
      loadInitializerRankings[ self.initializers[initializer].loadPriority ] = [];
    }

    if (startInitializerRankings[ self.initializers[initializer].startPriority ] === undefined) {
      startInitializerRankings[ self.initializers[initializer].startPriority ] = [];
    }

    // push loader state function to ranked arrays
    loadInitializerRankings[ self.initializers[initializer].loadPriority ].push(loadFunction);
    startInitializerRankings[ self.initializers[initializer].startPriority ].push(startFunction);
  });

  // organize final array to match the initializers priorities
  self.loadInitializers = flattenOrderedInitialzer(loadInitializerRankings);
  self.startInitializers = flattenOrderedInitialzer(startInitializerRankings);

  // on the end of loading all initializers set engine like initialized
  self.loadInitializers.push(function () {
    process.nextTick(function () {
      api.initialized = true;
      callback(null, self);
    });
  });

  // start initialization process
  async.series(self.loadInitializers, function (errors) { fatalError(self, errors, 'initialize'); });
};

/**
 * Start initializers.
 *
 * @param  {Function} callback
 */
var startInitializers = function (err, engine) {
  if (engine.api.initialized !== true) {
    throw new Error('The initializeds needs to be loaded.');
  }

  async.series(engine.startInitializers, function (err) { fatalError(engine, err, 'start'); });
};

// ---------------------------------------------------------------------------- [PUBLIC]

/**
 * Stellar main class.
 *
 * @constructor
 */
function Stellar() {

  /**
   * This object contains all shared functions.
   *
   * This object is used across all platform.
   *
   * @type {Object}
   */
  this.api = {
    initialized: false,
    started: false,

    /**
     * Default scope values.
     *
     * @type {Object}
     */
    scope: {},

    // todo: put this on a initializer
    log: new Log()
  };

  /**
   * Actions repository.
   *
   * @type {Actions}
   */
  this.actions = new Actions(this);
}

/**
 * Start the engine.
 *
 * @param  {Object} scope Object with the current environment.
 */
Stellar.prototype.bang = function(scope) {
  // save app scope, merge with the default values
  this.api.scope = _.merge(scope, this.api.scope);

  // load current work directory
  this.api.log.info(('Current universe "' + this.api.scope.rootPath + '"').magenta);

  // start initializers system
  loadInitializers.call(this, this.api, startInitializers);
};

/**
 * Stop the engine execution.
 */
Stellar.prototype.rip = function() {
  // todo
};

/**
 * Restart the engine.
 */
Stellar.prototype.reborn = function() {
  // todo
};

/**
 * Alias for `actions.add()` function.
 *
 * @param  {Object} action Action object.
 * @return {bool}          True if actions is added.
 */
Stellar.prototype.registerAction = function(action) {
  return this.actions.add(action);
};

// export Stellar class
module.exports = Stellar;
