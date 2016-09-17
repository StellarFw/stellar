'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _utils = require('../utils');

var _utils2 = _interopRequireDefault(_utils);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Manage the application secure params.
 */
var Params = function () {

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
  function Params(api) {
    _classCallCheck(this, Params);

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


  _createClass(Params, [{
    key: 'buildPostVariables',
    value: function buildPostVariables() {
      var self = this;

      var i = void 0,
          j = void 0;
      var postVariables = [];

      // push the global safe params for the 'postVariables'
      self.globalSafeParams.forEach(function (p) {
        return postVariables.push(p);
      });

      // iterate all actions files
      for (i in self.api.actions.actions) {
        // iterate all actions definitions
        for (j in self.api.actions.actions[i]) {
          // get current action
          var action = self.api.actions.actions[i][j];

          // iterate all inputs keys and add it to postVariables
          for (var key in action.inputs) {
            postVariables.push(key);
          }
        }
      }

      // remove the duplicated entries
      self.postVariables = _utils2.default.arrayUniqueify(postVariables);

      return self.postVariables;
    }
  }]);

  return Params;
}();

var _class = function () {
  function _class() {
    _classCallCheck(this, _class);

    this.loadPriority = 420;
  }

  /**
   * Initializer load priority.
   *
   * @type {number}
   */


  _createClass(_class, [{
    key: 'load',


    /**
     * Action to the executed on the initializer loading.
     *
     * @param api   Api reference.
     * @param next  Callback function.
     */
    value: function load(api, next) {
      // put the params API available to all platform
      api.params = new Params(api);

      // build the post variables
      api.params.buildPostVariables();

      // finish the initializer execution
      next();
    }
  }]);

  return _class;
}();

exports.default = _class;