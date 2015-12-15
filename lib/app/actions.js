/**
 * Actions class.
 *
 * @constructor
 *
 * @param {Stellar} engine Stellar engine instance.
 */
function Actions(engine) {

  /**
   * Engine instance.
   *
   * @type {Stellar}
   */
  this.engine = engine;

  /**
   * List of actions.
   *
   * @type {Object}
   */
  this.actions = {};

}

/**
 * Add a new action.
 *
 * @param {string} name      Action name
 * @return {bool}            True
 */
Actions.prototype.add = function(action) {
  this.actions[action.name] = action;
  return true;
};

/**
 * Remove an existing action.
 *
 * @param  {string} name Action name
 * @return {bool}        True if the action has been removed, false if the
 *                       actions not exists.
 */
Actions.prototype.remove = function(action_name) {
  // check if the action exists
  if (!this.has(action_name)) { return false; }

  // remove action
  _.omit(this.actions, action_name);

  return true;
};

/**
 * Check if an action exists.
 *
 * @param  {stirng}  action_name Action name.
 * @return {Boolean}             True if the action exists, false otherwise.
 */
Actions.prototype.has = function(action_name) {
  return this.actions[action_name] !== undefined;
};

/**
 * Execute an action.
 *
 * @param  {stirng}   action_name Action name.
 * @param  {array}    params      State object.
 * @param  {Function} callback    Action callback.
 * @return {bool}                 True if the action exists, false otherwise.
 */
Actions.prototype.call = function(action_name, state, callback) {
  // check if the action exists
  if (!this.has(action_name)) {
    callback(null, null);

    return false;
  }

  // get action object
  var action = this.actions[action_name];

  // execute the action code
  action.run(this.engine, state, callback);

  return true;
};

// export module
module.exports = Actions;
