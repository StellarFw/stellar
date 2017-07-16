'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
/**
 * Manage the application secure params.
 */
class Params {

  /**
   * Create a new instance of this class.
   *
   * @param api API reference.
   */


  /**
   * Special params we will always accept.
   *
   * @type {string[]}
   */
  constructor(api) {
    this.api = null;
    this.globalSafeParams = ['file', 'apiVersion', 'callback', 'action'];
    this.api = api;
  }

  /**
   * Build the hash map with all safe application params.
   *
   * @returns {*}
   */


  /**
   * List with all save params.
   */

  /**
   * API reference object
   *
   * @type {null}
   */
  buildPostVariables() {
    let self = this;

    let i, j;
    let postVariables = [];

    // push the global safe params for the 'postVariables'
    self.globalSafeParams.forEach(p => postVariables.push(p)

    // iterate all actions files
    );for (i in self.api.actions.actions) {
      // iterate all actions definitions
      for (j in self.api.actions.actions[i]) {
        // get current action
        let action = self.api.actions.actions[i][j];

        // iterate all inputs keys and add it to postVariables
        for (let key in action.inputs) {
          postVariables.push(key);
        }
      }
    }

    // remove the duplicated entries
    self.postVariables = this.api.utils.arrayUniqueify(postVariables);

    return self.postVariables;
  }
}

exports.default = class {
  constructor() {
    this.loadPriority = 420;
  }
  /**
   * Initializer load priority.
   *
   * @type {number}
   */


  /**
   * Action to the executed on the initializer loading.
   *
   * @param api   Api reference.
   * @param next  Callback function.
   */
  load(api, next) {
    // put the params API available to all platform
    api.params = new Params(api);

    // build the post variables
    api.params.buildPostVariables

    // finish the initializer execution
    ();next();
  }
};