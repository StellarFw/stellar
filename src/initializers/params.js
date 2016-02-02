import Utils from '../utils';

/**
 * Manage the application secure params.
 */
class Params {

  /**
   * API reference.
   */
  api;

  /**
   * Special params we will always accept.
   *
   * @type {string[]}
   */
  globalSafeParams = [ 'file', 'apiVersion', 'callback', 'action' ];

  /**
   * List with all save params.
   */
  postVariables;

  /**
   * Create a new instance of this class.
   *
   * @param api API reference.
   */
  constructor(api) {
    this.api = api;
  }

  /**
   * Build the hash map with all safe application params.
   *
   * @returns {*}
   */
  buildPostVariables() {
    let i, j;
    let self = this;
    let postVariables = [];

    // push the global safe params for the 'postVariables'
    self.globalSafeParams.forEach(function (p) {
      postVariables.push(p);
    });

    // iterate all actions files
    for (i in self.api.actions.actions) {
      // iterate all actions definitions
      for (j in self.api.actions.actions[ i ]) {
        // get current action
        let action = self.api.actions.actions[ i ][ j ];

        // iterate all inputs keys and add it to postVariables
        for (let key in action.inputs) {
          postVariables.push(key);
        }
      }
    }

    // remove the duplicated entries
    self.postVariables = Utils.arrayUniqueify(postVariables);

    return self.postVariables;
  }

}

export default class {

  /**
   * Initializer load priority.
   *
   * @type {number}
   */
  static loadPriority = 20;

  /**
   * Action to the executed on the initializer loading.
   *
   * @param api   Api reference.
   * @param next  Callback function.
   */
  static load(api, next) {
    api.params = new Params(api);

    api.params.buildPostVariables();

    next();
  }

}
