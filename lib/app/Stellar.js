/**
 * Module dependencies.
 */

var events  = require('events');
var Log     = require('log');

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

}

Stellar.prototype.bang = function(scope) {
  // save app scope
  this.scope = scope;

  // load current work directory
  this.log.info(('Current universe "' + scope.rootPath + '"').magenta);
};

// export Stellar class
module.exports = Stellar;
