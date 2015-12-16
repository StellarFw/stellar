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

// ---------------------------------------------------------------------------- [PUBLIC]

/**
 * Stellar main class.
 *
 * @constructor
 */
function Stellar() {

  // Inherit methods from EventEmitter
  events.EventEmitter.call(this);

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
 * Start initializers system.
 */
Stellar.prototype.startInitializersSystem = function() {
  var self = this;

  var loadInitializerRankings  = {};

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

    // require initializer
    self.initializers[initializer] = require(file);

    // create a new load function for this initializer
    var loadFunction = function (next) {

      // check if `initilize` property is a function
      if (typeof self.initializers[initializer].initialize === 'function') {
        // debug message
        if (typeof self.log.debug === 'function') {
          self.log.debug(('loading initializer: ' + initializer).white);
        }

        // call `initialize` property
        self.initializers[initializer].initialize(self, function (err) {
          try { self.log.debug(('loaded initializer: ' + initializer).white); } catch(e) { }
          next(err);
        });
      } else {
        next();
      }
    };

    if (loadInitializerRankings[ self.initializers[initializer].loadPriority ] === undefined) {
      loadInitializerRankings[ self.initializers[initializer].loadPriority ] = [];
    }

    // push initializer to the load ranked array
    loadInitializerRankings[ self.initializers[initializer].loadPriority ].push(loadFunction);
  });

  // organize final array to match the initializers priorities
  self.loadInitializers = flattenOrderedInitialzer(loadInitializerRankings);

  // on the end of loading all initializers set engine like initialized
  self.loadInitializers.push(function () {
    process.nextTick(function () { self.initialized = true; });
  });

  // start initialization process
  async.series(self.loadInitializers, function (errors) { fatalError(self, errors, 'initialize'); });
};

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
  this.startInitializersSystem();
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
