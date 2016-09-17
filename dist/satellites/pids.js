'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _cluster = require('cluster');

var _cluster2 = _interopRequireDefault(_cluster);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Pids = function () {

  /**
   * Class constructor.
   *
   * @param api API reference.
   */


  /**
   * API reference.
   */


  /**
   * Process ID.
   */


  /**
   * Pids folder.
   */
  function Pids(api) {
    _classCallCheck(this, Pids);

    // save API reference
    this.api = api;
  }

  /**
   * Init the pid manager.
   */


  /**
   * Process title.
   */


  _createClass(Pids, [{
    key: 'init',
    value: function init() {
      var self = this;

      // set the process id
      self.pid = process.pid;

      // save pids folder to syntax sugar
      self.path = self.api.config.general.paths.pid;

      // define the process name
      if (_cluster2.default.isMaster) {
        self.title = 'stellar-' + self._sanitizeId();
      } else {
        self.title = self._sanitizeId();
      }

      // create the 'pids' directory if not exists
      try {
        _fs2.default.mkdirSync(self.path);
      } catch (e) {}
    }

    /**
     * Write pid file.
     */

  }, {
    key: 'writePidFile',
    value: function writePidFile() {
      var self = this;
      _fs2.default.writeFileSync(self.path + '/' + self.title, self.pid.toString(), 'ascii');
    }

    /**
     * Clear pid file.
     */

  }, {
    key: 'clearPidFile',
    value: function clearPidFile() {
      var self = this;

      try {
        _fs2.default.unlinkSync(self.path + '/' + self.title);
      } catch (e) {
        self.api.log('Unable to remove pidfile', 'error', e);
      }
    }

    /**
     * Get a sanitized pid name for this process.
     *
     * The pid name is based on the process id.
     *
     * @returns {*}
     * @private
     */

  }, {
    key: '_sanitizeId',
    value: function _sanitizeId() {
      var self = this;
      var pidfile = self.api.id;

      pidfile = pidfile.replace(/:/g, '-');
      pidfile = pidfile.replace(/\s/g, '-');
      pidfile = pidfile.replace(/\r/g, '');
      pidfile = pidfile.replace(/\n/g, '');

      return pidfile;
    }
  }]);

  return Pids;
}();

var _class = function () {
  function _class() {
    _classCallCheck(this, _class);

    this.loadPriority = 110;
    this.startPriority = 1;
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
     * Load initializer.
     *
     * @param api   API reference.
     * @param next  Callback.
     */
    value: function load(api, next) {
      // add pids class to the API
      api.pids = new Pids(api);

      // init pid manager
      api.pids.init();

      // finish the initializer load
      next();
    }

    /**
     * Start initializer.
     *
     * @param api   API reference.
     * @param next  Callback.
     */

  }, {
    key: 'start',
    value: function start(api, next) {
      // write pid file
      api.pids.writePidFile();

      // log the process pid
      api.log('pid: ' + process.pid, 'notice');

      // finish the initializer start
      next();
    }
  }]);

  return _class;
}();

exports.default = _class;