import fs from 'fs';
import cluster from 'cluster';

class Pids {

  /**
   * API reference.
   */
  api;

  /**
   * Process ID.
   */
  pid;

  /**
   * Pids folder.
   */
  path;

  /**
   * Process title.
   */
  title;

  /**
   * Class constructor.
   *
   * @param api API reference.
   */
  constructor(api) {
    // save API reference
    this.api = api;
  }

  /**
   * Init the pid manager.
   */
  init() {
    let self = this;

    // set the process id
    self.pid = process.pid;

    // save pids folder to syntax sugar
    self.path = self.api.config.general.paths.pid;

    // define the process name
    if (cluster.isMaster) {
      self.title = `stellar-${self._sanitizeId()}`
    } else {
      self.title = self._sanitizeId();
    }

    // create the 'pids' directory if not exists
    try {
      fs.mkdirSync(self.path);
    } catch (e) {
    }
  }

  /**
   * Write pid file.
   */
  writePidFile() {
    let self = this;
    fs.writeFileSync(`${self.path}/${self.title}`, self.pid.toString(), 'ascii');
  }

  /**
   * Clear pid file.
   */
  clearPidFile() {
    let self = this;

    try {
      fs.unlinkSync(`${self.path}/${self.title}`);
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

export default class {

  /**
   * Load priority.
   *
   * @type {number}
   */
  static loadPriority = 110;

  /**
   * Start priority.
   *
   * @type {number}
   */
  static startPriority = 1;

  /**
   * Load initializer.
   *
   * @param api   API reference.
   * @param next  Callback.
   */
  static load(api, next) {
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
  static start(api, next) {
    // write pid file
    api.pids.writePidFile();

    // log the process pid
    api.log(`pid: ${process.pid}`, 'notice');

    // finish the initializer start
    next();
  }

}
