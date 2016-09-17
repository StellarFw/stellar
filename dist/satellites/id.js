'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _yargs = require('yargs');

var _utils = require('../utils');

var _utils2 = _interopRequireDefault(_utils);

var _cluster = require('cluster');

var _cluster2 = _interopRequireDefault(_cluster);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Setup the server ID.
 *
 * This ID, can be configured using:
 * - the 'api.config.general.id' configuration;
 * - '--title' option on the command line;
 * - 'STELLAR_TITLE' environment variable;
 * - or one can be generated automatically using the external server IP.
 */
var _class = function () {
  function _class() {
    _classCallCheck(this, _class);

    this.loadPriority = 100;
    this.startPriority = 2;
  }

  /**
   * Load priority.
   *
   * @type {number}
   */


  /**
   * Start priority.
   *
   * @type {number}
   */


  _createClass(_class, [{
    key: 'load',


    /**
     * Initializer load functions.
     *
     * @param api   API reference.
     * @param next  Callback.
     */
    value: function load(api, next) {
      if (_yargs.argv.title) {
        api.id = _yargs.argv.title;
      } else if (process.env.STELLAR_TITLE) {
        api.id = process.env.STELLAR_TITLE;
      } else if (!api.config.general.id) {
        // get servers external IP
        var externalIP = _utils2.default.getExternalIPAddress();

        if (externalIP === false) {
          var message = ' * Error fetching this host external IP address; setting id base to \'stellar\'';

          try {
            api.log(message, 'crit');
          } catch (e) {
            console.log(message);
          }
        }

        api.id = externalIP;
        if (_cluster2.default.isWorker) {
          api.id += ':' + process.pid;
        }
      } else {
        api.id = api.config.general.id;
      }

      // save Stellar version
      api.stellarVersion = require('../../package.json').version;

      // finish the initializer load
      next();
    }

    /**
     * Initializer start function.
     *
     * @param api   API reference.
     * @param next  Callback.
     */

  }, {
    key: 'start',
    value: function start(api, next) {
      // print out the server ID
      api.log('server ID: ' + api.id, 'notice');

      // finish the initializer start
      next();
    }
  }]);

  return _class;
}();

exports.default = _class;