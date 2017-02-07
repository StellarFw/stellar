'use strict'

// ----------------------------------------------------------------------------- [Imports]

let Command = require('../Command')
let Utils = require('../utils')

// ----------------------------------------------------------------------------- [Class]

class MakeListener extends Command {

  /**
   * Create a new MakeListener class instance.
   */
  constructor () {
    // execute the super class constructor methods
    super()

    // command definition
    this.command = 'listener <listener_name>'
    this.describe = 'Create a new event listener'
    this.builder = {
      module: {
        describe: 'Module where the action must be created',
        type: 'string',
        default: 'private'
      },
      force: {
        describe: 'Overwrite existent files',
        type: 'boolean',
        default: false
      }
    }
  }

  /**
   * Execute the command.
   */
  run () {
    if (this.args.module.length === 0) {
      return this.printError('You need to specify the module here the listener must be created')
    }

    // check if the module exists
    if (!Utils.moduleExists(this.args.module)) {
      return this.printError(`The module "${this.args.module}" does not exists`)
    }

    // get listener name
    let listenerName = this.args.listener_name

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
  }

}

// export command
module.exports = new MakeListener()
