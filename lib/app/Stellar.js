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

var fatalError = function(engine, errors, type){
  if (errors && !(errors instanceof Array)) { errors = [errors]; }

  if(errors) {
    engine.log.emergency(('Error with initializer step: ' + type).red);
    errors.forEach(function(err) {
      engine.log.emergency(err.stack.red);
    });
    process.exit(1);
  }
};

/**
 * Load initializers.
 */
var loadInitializers = function(callback) {
  var self = this;

  // default priorities
  var defaultPriorities = {
    load: 100,
    start: 100,
    stop: 100
  };

  var loadInitializerRankings  = {};
  var startInitializerRankings = {};

  // reset initializers arrays
  self.initializers = [];

  // get all initializers
  var initializers_files = Utils.getFiles(__dirname + '/initializers');

  // iterate all files
  _.forEach(initializers_files, function (f) {
    // normalize file path
    var file = path.normalize(f);

    // get initilizer basename
    var initializer = path.basename(f).split('.')[0];

    // get file extension
    var ext = _.last(file.split('.'));

    // only load files with the `js` extension
    if (ext !== 'js') { return; }

    // require initializer
    self.initializers[initializer] = require(file);

    // create a new load function for current initializer
    var loadFunction = function (next) {

      // check if the initializer have a load function
      if (typeof self.initializers[initializer].load === 'function') {
        try { self.log.debug(('loading initializer: ' + initializer).white); } catch(e) {}

        // call `load` property
        self.initializers[initializer].load(self, function (err) {
          try { self.log.debug(('loaded initializer: ' + initializer).white); } catch(e) { }
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
        try { self.log.debug(('loading initializer: ' + initializer).white); } catch(e) {}

        // execute start routine
        self.initializers[initializer].start(self, function (err) {
          try { self.log.debug(('started initializer: ' + initializer).white); } catch(e) { }
          next(err);
        });
      } else {
        next();
      }
    };

    // set default priority if needed
    if (self.initializers[initializer].loadPriority === undefined) {
      self.initializers[initializer].loadPriority = defaultPriorities.load;
    }

    if (self.initializers[initializer].startPriority === undefined) {
      self.initializers[initializer].startPriority = defaultPriorities.start;
    }


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
      self.initialized = true;
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
  if (engine.initialized !== true) {
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
   * Log instance.
   *
   * @type {Log}
   */
  this.log = new Log();

  /**
   * Default scope values.
   *
   * @type {Object}
   */
  this.scope = {};

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
  this.scope = _.merge(scope, this.scope);

  // load current work directory
  this.log.info(('Current universe "' + scope.rootPath + '"').magenta);

  // start initializers system
  loadInitializers.call(this, startInitializers);
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
