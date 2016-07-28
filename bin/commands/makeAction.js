'use strict'

// ----------------------------------------------------------------------------------------------------------- [Imports]

let Command = require('../Command')
let Utils = require('../utils')

// ------------------------------------------------------------------------------------------------------------- [Class]

class MakeAction extends Command {

  /**
   * Create a new MakeAction instance.
   * @param args
   */
  constructor (args) {
    // execute the super class constructor method
    super()

    // define usage
    this.usage = 'stellar makeAction <action_name> --module=<module_name> [--options]'

    // save the parsed console arguments
    this.args = args
  }

  /**
   * Execute the command
   */
  execute () {
    // we need to have the action name and the module name
    // here the action must be created
    if (this.args._.length < 2) {
      this.printUsage()
      return false
    }

    if (this.args.module === undefined || typeof this.args.module !== 'string' || this.args.module.length === 0) {
      this.printError('You need to specify the module here the action must be created')
      return false
    }

    // check if the module exists
    if (!Utils.moduleExists(this.args.module)) {
      this.printError(`The module "${this.args.module}" does not exists`)
      return false
    }

    // get useful action information
    let actionName = this.args._[ 1 ]
    let actionsPath = `${Utils.getCurrentUniverse()}/modules/${this.args.module}/actions`
    let outputPath = `${actionsPath}/${actionName.replace('.', '_')}.js`

    // create the actions folder is not exists
    if (!Utils.exists()) { Utils.createFolder(actionsPath) }

    // generate action file
    Utils.generateFileFromTemplate('action', { actionName: actionName }, outputPath)

    // print a success message
    this.printSuccess(`The "${actionName}" action was created!`)

    return true
  }
}

// export the function to execute the command
module.exports = args => (new MakeAction(args)).execute()
