'use strict'

// ----------------------------------------------------------------------------- [Imports]

let Command = require('../Command')
let Utils = require('../utils')

// ----------------------------------------------------------------------------- [Class]

class MakeListener extends Command {

  /**
   * Create a new MakeListener class instance.
   *
   * @param args Parsed command line arguments.
   */
  constructor (args) {
    // execute the super class constructor methods
    super()

    // define usage
    this.usage = 'stellar makeListener <listener_name> --module=<module_name> [--options]'

    // save the parsed console arguments
    this.args = args
  }

  /**
   * Execute the command.
   */
  execute () {
    // the listener name and the module name are required
    if (this.args._.length < 2) {
      this.printUsage()
      return false
    }

    if (this.args.module === undefined || typeof this.args.module !== 'string' || this.args.module.length === 0) {
      this.printError('You need to specify the module here the listener must be created')
      return false
    }

    // check if the module exists
    if (!Utils.moduleExists(this.args.module)) {
      this.printError(`The module "${this.args.module}" does not exists`)
      return false
    }

    // get listener name
    let listenerName = this.args._[ 1 ]

    // get listeners folder path
    let listenersPath = `${Utils.getCurrentUniverse()}/modules/${this.args.module}/listeners`

    // build the full listener path
    let outputPath = `${listenersPath}/${listenerName.replace(/\./g, '_')}.js`

    // create listeners folder if not exists
    Utils.createFolderIfNotExists(listenersPath)

    // generate listener file
    Utils.generateFileFromTemplate('listener', { name: listenerName }, outputPath)

    // print a success message
    this.printSuccess(`The "${listenerName}" listener was created!`)

    return true
  }

}

// export the function to execute the command
module.exports = args => (new MakeListener(args)).execute()
