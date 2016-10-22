'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _cluster = require('cluster');

var _cluster2 = _interopRequireDefault(_cluster);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class Pids {

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
  constructor(api) {
    // save API reference
    this.api = api;
  }

  /**
   * Init the pid manager.
   */


  /**
   * Process title.
   */
  init() {
    let self = this;

    // set the process id
    self.pid = process.pid;

    // save pids folder to syntax sugar
    self.path = self.api.config.general.paths.pid;

    // define the process name
    if (_cluster2.default.isMaster) {
      self.title = `stellar-${ self._sanitizeId() }`;
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
  writePidFile() {
    let self = this;
    _fs2.default.writeFileSync(`${ self.path }/${ self.title }`, self.pid.toString(), 'ascii');
  }

  /**
   * Clear pid file.
   */
  clearPidFile() {
    let self = this;

    try {
      _fs2.default.unlinkSync(`${ self.path }/${ self.title }`);
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
  _sanitizeId() {
    let self = this;
    let pidfile = self.api.id;

    pidfile = pidfile.replace(/:/g, '-');
    pidfile = pidfile.replace(/\s/g, '-');
    pidfile = pidfile.replace(/\r/g, '');
    pidfile = pidfile.replace(/\n/g, '');

    return pidfile;
  }

}

exports.default = class {
  constructor() {
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


  /**
   * Load initializer.
   *
   * @param api   API reference.
   * @param next  Callback.
   */
  load(api, next) {
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
  start(api, next) {
    // write pid file
    api.pids.writePidFile();

    // log the process pid
    api.log(`pid: ${ process.pid }`, 'notice');

    // finish the initializer start
    next();
  }

};