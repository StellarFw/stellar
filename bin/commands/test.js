'use strict'

// ---------------------------------------------------------------------------- [Imports]

const fs = require('fs')
const path = require('path')
const Mocha = require('mocha')
const Utils = require('../utils')
const Command = require('../Command')
const Engine = require('../../dist/engine').default

// ---------------------------------------------------------------------------- [Class]

/**
 * Test command class.
 */
class TestCommand extends Command {

  /**
   * Create a new TestCommand instance.
   *
   * @param args  Command arguments.
   */
  constructor (args) {
    // execute the super class constructor method
    super()

    // define the usage
    this.usage = `stellar test [--options]`

    // save the parsed console arguments
    this.args = args
  }

  /**
   * Get the modules tests folder.
   *
   * @param moduleName  Module name to get the tests folder path.
   */
  getModuleTestPath (moduleName) {
    return `${Utils.getCurrentUniverse()}/modules/${moduleName}/tests`
  }

  /**
   * Execute the command.
   */
  execute () {
    let self = this

    // get all active modules from the application
    const modules = Utils.getAppModules()

    // if the modules are empty return a message
    if (modules.length === 0) {
      self.printInfo(`There is no active module to run tests.`)
      return true
    }

    // instantiate a Mocha instance
    const mocha = new Mocha()

    // iterate all modules and add the test file to the mocha
    modules.forEach(moduleName => {
      let testsPath = self.getModuleTestPath(moduleName)

      // ignore the folder if this not exists
      if (!Utils.exists(testsPath)) { return }

      fs.readdirSync(testsPath)
        .filter(file => file.substr(-3) === '.js')
        .forEach(file => mocha.addFile(path.join(testsPath, file)))
    })

    console.log(`${this.FgBlue}Starting Stellar test suit in your application`)

    // inject some useful objects to avoid add mocha, should and stellar to the
    // modules npm dependencies
    global.should = require('should')
    global.engine = new Engine({ rootPath: Utils.getCurrentUniverse() })

    // define the environment to test mode
    process.env.NODE_ENV = 'test'

    // run the tests
    mocha.run(failures => { process.on('exit', () => process.exit(failures)) })
  }

}

// exports the function to execute the command
module.exports = args => (new TestCommand(args)).execute()
