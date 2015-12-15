/**
 * Module dependencies.
 */

var _       = require('lodash');
var events  = require('events');
var Log     = require('log');
var Modules = require('./modules');
var Actions = require('./actions');

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
   * List with the loaded modules.
   *
   * @type {Object}
   */
  this.modulesMng = new Modules(this);

  /**
   * Actions repository.
   *
   * @type {Actions}
   */
  this.actions = new Actions(this);
}

Stellar.prototype.bang = function(scope) {
  // save app scope, merge with the default values
  this.scope = _.merge(scope, this.scope);

  // load current work directory
  this.log.info(('Current universe "' + scope.rootPath + '"').magenta);

  // read modules
  this.modulesMng.readModules();

  // load modules
  this.modulesMng.loadModules();

  // @temp TEST
  var self = this;
  var data = { response: {} };
  var result = this.actions.call('test', data, function () {
    self.log.info("Number > ", data);
  });
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
