'use strict'

const os = require('os')
const cluster = require('cluster')
const Command = require('../Command.js')

class RunCommand extends Command {
  constructor () {
    super(true)

    this.flags = 'run'
    this.desc = 'Start a new Stellar instance'
    this.setup = sywac => {
      sywac
        .boolean('--prod', { desc: 'Enable production mode' })
        .number('--port <port>', {
          desc: 'Port where the server will listening',
          defaultValue: 8080
        })
        .boolean('--clean', { desc: 'Remove all temporary files and node modules' })
        .boolean('--update', { desc: 'Update dependencies' })
        .boolean('--cluster', {
          group: 'Cluster Options:',
          desc: 'Run Stellar as a cluster'
        })
        .string('--id <cluster-id>', {
          group: 'Cluster Options:',
          desc: 'Cluster identifier',
          defaultValue: 'stellar-cluster'
        })
        .boolean('--silent', {
          group: 'Cluster Options:',
          desc: 'No messages will be printed to the console'
        })
        .number('--workers <number>', {
          group: 'Cluster Options:',
          desc: 'Number of workers'
        })
        .string('--workerPrefix <prefix>', {
          group: 'Cluster Options:',
          desc: `Worker's name prefix. If the value is equals to 'hostname' the computer hostname will be used`
        })
        .outputSettings({ maxWidth: 79 })
    }

    this.state = 'stopped'
    this.shutdownTimeout = 1000 * 30
    this.checkForInternalStopTimer = null
  }

  exec () {
    // whether the `--cluster` options is defined we stop this command and load
    // the startCluster
    if (this.args.cluster === true) {
      return require('./startCluster').handler(this.args)
    }

    // number of ms to wait to do a force shutdown if the Stellar won't stop
    // gracefully
    if (process.env.STELLAR_SHUTDOWN_TIMEOUT) {
      this.shutdownTimeout = parseInt(process.env.STELLAR_SHUTDOWN_TIMEOUT)
    }

    // if the process is a worker we need configure it to communicate with the
    // parent
    if (cluster.isWorker) {
      // set the communication behavior
      process.on('message', (msg) => {
        switch (msg) {
          // start the server
          case 'start':
            this.startServer()
            break
          // stop the server
          case 'stop':
            this.stopServer()
            break
          // stop process
          //
          // in cluster, we cannot re-bind the port, so kill this worker, and
          // then let the cluster start a new worker
          case 'stopProcess':
          case 'restart':
            this.stopProcess()
            break
        }
      })

      // define action to be performed on an 'uncaughtException' event
      process.on('uncaughtException', error => {
        let stack

        try {
          stack = error.stack.split(os.EOL)
        } catch (e) {
          stack = [error]
        }

        // send the exception to the master
        process.send({
          uncaughtException: {
            message: error.message,
            stack
          }
        })

        // finish the process on the next tick
        process.nextTick(process.exit)
      })

      // define action to be performed on an 'unhandledRejection' event
      process.on('unhandledRejection', (reason, p) => {
        // send the reason the the master
        process.send({ unhandledRejection: { reason, p } })

        // finish the process on the next tick
        process.nextTick(process.exit)
      })
    }

    // defines the action to be performed when a particular event occurs
    process.on('SIGINT', () => this.stopProcess())
    process.on('SIGTERM', () => this.stopProcess())
    process.on('SIGUSR2', () => this.restartServer())

    this.startServer()
  }

  // --------------------------------------------------------------------------- [Actions]

  /**
   * Start the server execution.
   *
   * @param callback Callback function.
   */
  async startServer (callback) {
    this._updateServerState('starting')

    try {
      await this.engine.start()

      this._updateServerState('started')
    } catch (error) {
      // TODO: I thinks this isn't a good idea since the engine can be
      // in an invalid state.
      this.api.log(error);
      return process.exit(1)
    }

    // this.engine.start((error, _) => {
    //   if (error) {
    //     this.api.log(error)
    //     process.exit(1)
    //     return
    //   }

    //   // update the server state
    //   this._updateServerState('started')

    //   // start check for the engine internal state
    //   this._checkForInternalStop()

    //   // execute the callback function
    //   if (typeof callback === 'function') { callback(null, this.api) }
    // })
  }

  /**
   * Stop server.
   *
   * @param callback Callback function.
   */
  stopServer (callback) {
    // update the server state
    this._updateServerState('stopping')

    // call the server stop function
    this.engine.stop(_ => {
      // update the server state
      this._updateServerState('stopped')

      // execute the callback function
      if (typeof callback === 'function') { callback(null, this.api) }
    })
  }

  /**
   * Restart the server.
   *
   * @param callback Callback function.
   */
  restartServer (callback) {
    // update the server state
    this._updateServerState('restarting')

    // restart the server
    this.engine.restart((error, _) => {
      // if an error occurs throw it
      if (error) { throw error }

      // update the server state
      this._updateServerState('started')

      // execute the callback function
      if (typeof callback === 'function') { callback(null, this.api) }
    })
  }

  /**
   * Stop the process.
   */
  stopProcess () {
    // put a time limit to shutdown the server
    setTimeout(() => process.exit(1), this.shutdownTimeout)

    // stop the server
    this.stopServer(() => process.nextTick(() => process.exit()))
  }

  /**
   * Update the server state and notify the master if the current process is a
   * cluster worker.
   */
  _updateServerState (newState) {
    this.state = newState
    if (cluster.isWorker) { process.send({ state: this.state }) }
  }

  /**
   * Check if the engine stops.
   */
  _checkForInternalStop () {
    // clear timeout
    clearTimeout(this.checkForInternalStopTimer)

    // if the engine executing stops finish the process
    if (this.api.status !== 'running' && this.status !== 'started') {
      process.exit(0)
    }

    // create a new timeout
    this.checkForInternalStopTimer = setTimeout(_ => {
      this._checkForInternalStop()
    }, this.shutdownTimeout)
  }
}

// export the command instance
module.exports = (new RunCommand())
