import fs from "fs";
import cluster from "cluster";

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
    // set the process id
    this.pid = process.pid;

    // save pids folder to syntax sugar
    this.path = this.api.config.general.paths.pid;

    // define the process name
    if (cluster.isMaster) {
      this.title = `stellar-${this._sanitizeId()}`;
    } else {
      this.title = this._sanitizeId();
    }

    // create the 'pids' directory if not exists
    try {
      fs.mkdirSync(this.path);
    } catch (e) {
      // ignore error
    }
  }

  /**
   * Write pid file.
   */
  writePidFile() {
    fs.writeFileSync(`${this.path}/${this.title}`, this.pid.toString(), "ascii");
  }

  /**
   * Clear pid file.
   */
  clearPidFile() {
    try {
      fs.unlinkSync(`${this.path}/${this.title}`);
    } catch (e) {
      this.api.log("Unable to remove pidfile", "error", e);
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
    let pidfile = this.api.id;

    pidfile = pidfile.replace(/:/g, "-");
    pidfile = pidfile.replace(/\s/g, "-");
    pidfile = pidfile.replace(/\r/g, "");
    pidfile = pidfile.replace(/\n/g, "");

    return pidfile;
  }
}

export default class {
  /**
   * Load priority.
   *
   * @type {number}
   */
  loadPriority = 110;

  /**
   * Start priority.
   *
   * @type {number}
   */
  startPriority = 1;

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
    api.log(`pid: ${process.pid}`, "notice");

    // finish the initializer start
    next();
  }
}
