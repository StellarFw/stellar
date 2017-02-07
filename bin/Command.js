'use strict'

// ----------------------------------------------------------------------------- [Imports]

const Engine = require('../dist/engine').default
const path = require('path')
const pkg = require('../package.json')
const spawn = require('child_process').spawn

// ----------------------------------------------------------------------------- [Module]
/**
 * All command extends this class in order to initialize Stellar and
 * provide a standard way of creating commands.
 */
module.exports = class {

  /**
   * Creates a new command instance.
   *
   * @type {boolean} initialize When true Stellar will be initialized on the
   * handler method execution.
   */
  constructor (initialize = false) {
    // define the console colors
    this.FgRed = '\x1b[31m'
    this.FgGreen = '\x1b[32m'
    this.FgYellow = '\x1b[33m'
    this.FgBlue = '\x1b[34m'
    this.FgWhite = '\x1b[37m'
    this.FgDefault = '\x1b[39m'

    // store if is to initialize
    this.isToInitialize = initialize
    this.api = null
    this.engine = null

    // FIX `this` binding in the `handler` method
    this.handler = this.handler.bind(this)
  }

  /**
   * Build the scope to create a new Stellar instance.
   */
  _buildScope () {
    return {
      rootPath: process.cwd(),
      stellarPackageJSON: pkg,
      args: this.args
    }
  }

  /**
   * Initialize a Stellar instance when requested.
   */
  _initializeStellar () {
    return new Promise((resolve, reject) => {
      // build the scope
      const scope = this._buildScope()

      // create a new engine instance and save it
      this.engine = new Engine(scope)

      // initialize the engine
      this.engine.initialize((error, api) => {
        // if an error occurs reject the promise and return
        if (error) { return reject(error) }

        // otherwise, store the API reference
        this.api = api

        // resolve the promise
        resolve(this.api)
      })
    })
  }

  /**
   * Catch the yargs command call.
   */
  handler (args) {
    // store the args
    this.args = args

    // if the user requested to run this as a deamon we must spawn a new process
    if (this.args.deamon) {
      // create a new set of arguments removing the `--daemon` options
      const newArgs = process.argv.splice(2)
      for (const i in newArgs) {
        if (newArgs[i].indexOf('--daemon') >= 0) { newArgs.splice(i, 1) }
      }
      newArgs.push('--isDaemon=true')

      const command = path.normalize(`${__dirname}/stellar`)
      const child = spawn(command, newArgs, { detached: true, cwd: process.cwd(), env: process.env, stdio: 'ignore' })
      console.log(`${command} ${newArgs.join(' ')}`)
      console.log(`Spawned child process with pid ${child.pid}`)

      // finish the current process
      process.nextTick(process.exit)
      return
    }

    // check if is to initialize the Engine
    if (this.isToInitialize) {
      return this._initializeStellar()
        .then(_ => { this.run() })
        .catch(error => { this.printError(error) })
    }

    // run the command
    this.run()
  }

  /**
   * Print an error message.
   *
   * @param msg Message to be printed.
   */
  printError (msg) { console.log(`\n${this.FgRed}Error: ${msg}\n`) }

  /**
   * Print an info message.
   *
   * @param msg Message to be printed.
   */
  printInfo (msg) { console.log(`\n${this.FgBlue}Info: ${msg}\n`) }

  /**
   * Print a success message.
   *
   * @param msg Message to be printed.
   */
  printSuccess (msg) { console.log(`\n${this.FgGreen}Success: ${msg}\n`) }

}
