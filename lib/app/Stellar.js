/**
 * Module dependencies.
 */

var _       = require('lodash');
var events  = require('events');
var Log     = require('log');
var Modules = require('./modules');
var Actions = require('./actions');
var io      = require('socket.io')();

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

  // read modules
  this.modulesMng.readModules();

  // load modules
  this.modulesMng.loadModules();

  // start socket server
  this.startSocket();
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

Stellar.prototype.startSocket = function() {
  var self = this;

  io.on('connection', function (socket) {

    // debug msg
    self.log.info('Client connected...');

    // on action call
    socket.on('call', function (action_id) {
      // connection state
      var data = { response: {} };

      // execute requested action
      self.actions.call(action_id, data, function () {
        // send response to client
        socket.emit('action_response', data.response);
      });
    });

  });

  io.listen(3000);
};

// export Stellar class
module.exports = Stellar;
