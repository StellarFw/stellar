// ----------------------------------------------------------------------------------------------------------- [Imports]

var os = require('os');
var cluster = require('cluster');
var package = require('../../package.json');
var Engine = require('../../dist/engine').default;

// ------------------------------------------------------------------------------------------------------------ [Module]

module.exports = function () {
  // build initial scope
  var scope = {
    rootPath: process.cwd(),
    stellarPackageJSON: package
  };

  // number of ms to wait to do a force shutdown if the Stellar won't stop gracefully
  var shutdownTimeout = 1000 * 30;
  if (process.env.STELLAR_SHUTDOWN_TIMEOUT) { shutdownTimeout = parseInt(process.env.STELLAR_SHUTDOWN_TIMEOUT); }

  // API reference
  var api = null;

  // process state
  var state = 'stopped';

  // create a stellar engine instance
  var engine = new Engine(scope);

  // save the timer who checks the internal stop
  var checkForInternalStopTimer;

  /**
   * Checks if the engine stops.
   */
  var checkForInternalStop = function () {
    // clear timeout
    clearTimeout(checkForInternalStopTimer);

    // if the engine executing stops finish the process
    if (engine.api.running !== true) { process.exit(0); }

    // create a new timeout
    checkForInternalStopTimer = setTimeout(checkForInternalStop, shutdownTimeout);
  };

  // -------------------------------------------------------------------------------------------------- [Actions Server]

  /**
   * Start the server execution.
   *
   * @param callback Callback function.
   */
  var startServer = function (callback) {
    // set the engine state to 'starting'
    state = 'starting';

    // inform the new work start to the master
    if (cluster.isWorker) { process.send({state: state}); }

    // start the engine
    engine.start(function (err, apiFromCallback) {
      if (err) {
        binary.log(err);
        process.exit(1);
      } else {
        // set the engine state to 'started'
        state = 'started';

        // inform the new work start to the master
        if (cluster.isWorker) { process.send({state: state}); }

        // save the api instance
        api = apiFromCallback;

        // start check for the engine internal state
        checkForInternalStop();

        // execute the callback if defined
        if (typeof callback === 'function') { callback(null, api); }
      }
    });
  };

  /**
   * Stop server.
   *
   * @param callback Callback function.
   */
  var stopServer = function (callback) {
    state = 'stopping';

    if (cluster.isWorker) { process.send({state: state}); }

    engine.stop(function () {
      state = 'stopped';
      if (cluster.isWorker) { process.send({state: state}); }
      api = null;
      if (typeof  callback === 'function') { callback(null, api); }
    });
  };

  /**
   * Restart the server.
   *
   * @param callback Callback function.
   */
  var restartServer = function (callback) {
    // set engine state to 'restarting'
    state = 'restarting';

    // if this process is a worker, inform the new state to the master
    if (process.isWorker) { process.send({state: state}); }

    // restart the server
    engine.restart(function (err, apiFromCallback) {
      // set the server state to 'started'
      state = 'started';

      // if this process is a worker, inform the new state to the master
      if (process.isWorker) { process.send({state: state}); }

      // save the new api object
      api = apiFromCallback;

      // if the callback is defined execute him
      if (typeof callback === 'function') { callback(null, api); }
    });
  };

  // --------------------------------------------------------------------------------------------------------- [Process]

  /**
   * Stop the process.
   */
  var stopProcess = function () {
    // put a time limit to shutdown the server
    setTimeout(function () { process.exit(1); }, shutdownTimeout);

    // stop the server
    stopServer(function () {
      process.nextTick(function () {
        process.exit();
      })
    });
  };

  if (cluster.isWorker) {
    // define action to te performed on 'message' event
    process.on('message', function (msg) {
      switch (msg) {
        case 'start':
          // start the server
          startServer();
          break;
        case 'stop':
          // stop the server
          stopServer();
          break;
        case 'stopProcess':
          // stop process
          stopProcess();
          break;
        case 'restart':
          // in cluster, we cannot re-bind the port, so kill this worker, and
          // then let the cluster start a new worker
          stopProcess();
          break;
      }
    });

    // define action to te performed on 'uncaughtException' event
    process.on('uncaughtException', function (error) {
      // send the exception to the master
      process.send({
        uncaughtException: {
          message: error.message,
          stack: error.stack.split(os.EOL)
        }
      });

      // finish the process on the next tick
      process.nextTick(process.exit);
    });

    // define action to te performed on 'unhandledRejection' event
    process.on('unhandledRejection', function (reason, p) {
      // send the reason the the master
      process.send({unhandledRejection: {reason: reason, p: p}});

      // finish the process on the next tick
      process.nextTick(process.exit);
    });
  }

  // defines the action to be performed when a particular event occurs
  process.on('SIGINT', function () { stopProcess(); });
  process.on('SIGTERM', function () { stopProcess(); });
  process.on('SIGUSR2', function () { restartServer(); });

  // start the server!
  startServer();
};
