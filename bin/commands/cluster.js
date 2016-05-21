"use strict";

var fs = require('fs');
var os = require('os');
var path = require('path');
var async = require('async');
var cluster = require('cluster');
var winston = require('winston');
var isRunning = require('is-running');

/**
 * This class represent a cluster Worker.
 */
class Worker {

  /**
   * Constructor.
   *
   * @param parent  Parent worker.
   * @param id      Worker identifier.
   * @param env     Environment.
   */
  constructor(parent, id, env) {
    this.state = null;
    this.id = id;
    this.env = env;
    this.parent = parent;
  }

  /**
   * Define the log prefix for this worker.
   *
   * @returns {string}
   */
  logPrefix() {
    let self = this;
    let s = '';

    s += `[worker #${self.id}`;

    if (self.worker && self.worker.process) {
      s += ` (${self.worker.process.pid})]: `;
    } else {
      s += ']: ';
    }

    return s;
  }

  /**
   * Log a message.
   *
   * @param message   Message to be logged.
   * @param severity  Log Severity.
   */
  log(message, severity) {
    let self = this;

    // set default value
    severity = severity || 'debug';

    self.parent.log(self.logPrefix() + message, severity);
  }

  /**
   * Start the worker execution.
   */
  start() {
    let self = this;

    // create the worker
    self.worker = cluster.fork(self.env);

    // define the exit action
    self.worker.on('exit', () => {
      self.log('exited', 'info');

      // remove the worker
      for (let i in self.parent.workers) {
        if (self.parent.workers[ i ].id === self.id) {
          self.parent.workers.splice(i, 1);
          break;
        }
      }

      self.parent.work();
    });

    self.worker.on('message', (message) => {
      // update the worker state if it exists in the message
      if (message.state) {
        self.state = message.state;
        self.log(message.state, 'info');
      }

      // is a 'uncaughtException'
      if (message.uncaughtException) {
        self.log('uncaught exception => ' + message.uncaughtException.message, 'alert');
        message.uncaughtException.state.forEach((line) => {
          self.log(`   ${line}`, 'alert');
        });
        self.parent.flapCount++;
      }

      // if is a 'unhandledRejection'
      if (message.unhandledRejection) {
        self.log('unhandled rejection => ' + JSON.stringify(message.unhandledRejection), 'alert');
        self.parent.flapCount++;
      }

      self.parent.work();
    });
  }

  /**
   * Stop the worker execution.
   */
  stop() {
    this.worker.send('stopProcess');
  }

  /**
   *
   */
  restart() {
    this.worker.send('restart');
  }

}

/**
 * Cluster manager class.
 */
class ClusterManager {

  /**
   * Class constructor.
   *
   * @param args Options
   */
  constructor(args) {
    let self = this;

    // class variables
    self.workers = [];
    self.workersToRestart = [];
    self.flapCount = 0;

    // get default options
    self.options = ClusterManager.defaults();

    // subscribe default options
    for (let i in self.options) {
      if (args[ i ] !== null && args[ i ] !== undefined) {
        self.options[ i ] = args[ i ];
      }
    }

    // config the logger
    let transports = [];

    // add a file logger by default
    transports.push(new (winston.transports.File)({
      filename: self.options.logPath + '/' + self.options.logFile
    }));

    // if this is the master process add a console transport
    if (cluster.isMaster && args.silent !== true) {
      transports.push(new (winston.transports.Console)({
        colorize: true,
        timestamp: true
      }));
    }

    // init the logger
    self.logger = new (winston.Logger)({
      levels: winston.config.syslog.levels,
      transports: transports
    });
  }

  /**
   * This method create a new directory if that not exists.
   *
   * @param path      Path to the directory to be created.
   * @param callback  Callback function.
   */
  static configurePath(path, callback) {
    // make the 'logs' folder if not exists
    if (!fs.existsSync(path)) { fs.mkdirSync(path); }

    // executes the callback function
    callback();
  }

  /**
   * Log a message.
   *
   * @param message   Message to be logged.
   * @param severity  Severity of the message.
   */
  log(message, severity) {
    let self = this;
    self.logger.log(severity, message);
  }

  /**
   * Return the cluster default options.
   *
   * @returns {{stopTimeout: number, expectedWorkers: *, flapWindow: number, execPath: String, pidPath: string, logPath: string, workerTitlePrefix: string, args: string, buildEnv: null}}
   */
  static defaults() {
    return {
      stopTimeout: 3000,
      expectedWorkers: os.cpus().length,
      flapWindow: 1000 * 30,
      execPath: __filename,
      tempPath: process.cwd() + '/temp',
      pidPath: process.cwd() + '/temp/pids',
      pidFile: 'cluster_pidfile',
      logPath: process.cwd() + '/temp/logs',
      logFile: 'cluster.log',
      workerTitlePrefix: 'stellar-worker-',
      args: '',
      buildEnv: null
    };
  }

  /**
   * Build worker environment.
   *
   * @param workerId  Worker identifier.
   * @returns {*}     Hash with the environment options.
   */
  buildEnv(workerId) {
    let self = this;

    if (typeof self.options.buildEnv === 'function') {
      return self.options.buildEnv.call(self, workerId);
    } else {
      return {
        title: self.options.workerTitlePrefix + workerId
      };
    }
  }

  /**
   * Write the process pid on the file.
   *
   * @param callback  Callback function.
   */
  writePidFile(callback) {
    let self = this;

    // build the pid file path
    let file = self.options.pidPath + '/' + self.options.pidFile;

    // if exists throw an error. We can not have two instances of the same project
    if (fs.existsSync(file)) {
      // get the old pid saved on the pids file
      let oldPid = parseInt(fs.readFileSync(file));

      if (isRunning(oldPid)) {
        return callback(new Error(`Stellar already running (pid ${oldpid})`));
      }
    }

    // write the new process pid
    fs.writeFileSync(file, process.pid);

    // executes the callback on the next tick
    process.nextTick(callback);
  }

  /**
   * Start the cluster manager.
   *
   * @param callback  Callback function.
   */
  start(callback) {
    let self = this;
    let jobs = [];

    // log the options
    self.log(JSON.stringify(self.options), 'debug');

    // configure the master
    cluster.setupMaster({
      exec: self.options.execPath,
      args: self.options.args.split(' '),
      silent: true
    });

    // set 'SIGINT' event
    process.on('SIGINT', () => {
      self.log('Signal: SIGINT', 'info');
      self.stop(process.exit);
    });

    // set 'SIGTERM' event
    process.on('SIGTERM', () => {
      self.log('Signal: SIGTERM', 'info');
      self.stop(process.exit);
    });

    // set 'SIGUSR2' event
    process.on('SIGUSR2', () => {
      self.log('Signal: SIGUSR2', 'info');
      self.log('swap out new workers one-by-one', 'info');
      self.workers.forEach((worker) => {
        self.workersToRestart.push(worker.id);
      });
      self.work();
    });

    // set 'SIGHUP' event
    process.on('SIGHUP', () => {
      self.log('Signal: SIGHUP', 'info');
      self.log('reload all workers now', 'info');
      self.workers.forEach((worker) => {
        worker.restart();
      });
    });

    // set 'SIGTTIN' event
    process.on('SIGTTIN', () => {
      self.log('Signal: SIGTTIN', 'info');
      self.log('add a worker', 'info');
      self.options.expectedWorkers++;
      self.work();
    });

    // set 'SIGTTOU' event
    process.on('SIGTTOU', () => {
      self.log('Signal: SIGTTOU', 'info');
      self.log('remove a worker', 'info');
      self.options.expectedWorkers--;
      self.work();
    });

    // push the initial jobs to the queue
    jobs.push((done) => {
      if (self.flapTimer) { clearInterval(self.flapTimer); }

      self.flapTimer = setInterval(() => {
        if (self.flapCount > (self.options.expectedWorkers * 2)) {
          self.log(`CLUSTER IS FLAPPING (${self.flapCount} crashes in ${self.options.flapWindow} ms). Stopping`, 'emerg');
          self.stop(process.exit);
        } else {
          self.flapCount = 0;
        }
      }, self.options.flapWindow);

      // finish the job execution
      done();
    });

    // config some folders
    jobs.push((done) => { ClusterManager.configurePath(self.options.tempPath, done); });
    jobs.push((done) => { ClusterManager.configurePath(self.options.logPath, done); });
    jobs.push((done) => { ClusterManager.configurePath(self.options.pidPath, done); });

    // write workers pids
    jobs.push((done) => { self.writePidFile(done); });

    // execute the queued jobs
    async.series(jobs, (error) => {
      if (error) {
        self.log(error, 'error');
        process.exit(1)
      } else {
        self.work();
        if (typeof callback === 'function') { callback(); }
      }
    });
  }

  /**
   * Stop the cluster.
   *
   * @param callback Function to be executed at the end.
   */
  stop(callback) {
    let self = this;

    // execute the callback when the number of works goes to zero
    if (self.workers.length === 0) {
      self.log('all workers stopped', 'notice');
      callback();
    } else {
      self.log(`{self.workers.length} workers running, waiting on stop`, 'info');
      setTimeout(() => { self.stop(callback); }, self.options.stopTimeout);
    }

    // prevent the creation of new workers
    if (self.options.expectedWorkers > 0) {
      self.options.expectedWorkers = 0;
      self.work();
    }
  }

  /**
   * Sort the workers.
   */
  sortWorkers() {
    let self = this;
    self.workers.sort((a, b) => { return (a.id > b.id); });
  }

  work() {
    let self = this;
    let worker;
    let workerId;
    let stateCounts = {};

    // sort the workers
    self.sortWorkers();

    // group workers by their state
    self.workers.forEach((worker) => {
      if (!stateCounts[ worker.state ]) { stateCounts[ worker.state ] = 0; }
      stateCounts[ worker.state ]++;
    });

    // if the state changes log a message
    if (self.options.expectedWorkers < self.workers.length && !stateCounts.stopping && !stateCounts.stopped && !stateCounts.restarting) {
      worker = self.workers[ (self.workers.length - 1) ];
      self.log(`signaling worker #${worker.id} to stop`, 'info');
      worker.stop();
    } else if (self.options.expectedWorkers > self.workers.length && !stateCounts.starting && !stateCounts.restarting) {
      workerId = 1;
      self.workers.forEach((worker) => {
        if (worker.id === workerId) {
          workerId++;
        }
      });

      self.log(`starting worker #${workerId}`, 'info');
      var env = self.buildEnv(workerId);
      worker = new Worker(self, workerId, env);
      worker.start();
      self.workers.push(worker);
    }
    else if (
      self.workersToRestart.length > 0 && !stateCounts.starting && !stateCounts.stopping && !stateCounts.stopped && !stateCounts.restarting
    ) {
      workerId = self.workersToRestart.pop();
      self.workers.forEach((worker) => {
        if (worker.id === workerId) { worker.stop(); }
      });
    }

    else {
      if (stateCounts.started === self.workers.length) {
        self.log(`cluster equilibrium state reached with ${self.workers.length} workers`, 'notice');
      }
    }
  }

}

/**
 * Exports the module.
 */
module.exports = function () {
  var options = {
    execPath: path.normalize(__dirname + '/stellar'),
    args: 'run'
  };

  // create a new cluster manager
  let manager = new ClusterManager(options);

  // start cluster
  manager.start();
};
