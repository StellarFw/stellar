'use strict'

// ----------------------------------------------------------------------------- [Imports]

let Command = require('../Command')
let Utils = require('../utils')

// ----------------------------------------------------------------------------- [Class]

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
    let actionName = this.args._[ 1 ] || this.args.model
    let actionsPath = `${Utils.getCurrentUniverse()}/modules/${this.args.module}/actions`
    let outputPath = `${actionsPath}/${actionName.replace('.', '_')}.js`

    // the actionName needs to be present
    if (!actionName) {
      this.printError('You need to specify the action name or the model')
      return false
    }

    // if there is not force param and the file already exists return an error
    // message
    if (this.args.force === undefined && Utils.exists(outputPath)) {
      this.printError(`The action file already exists. Use --force param to overwrite.`)
      return false
    }

    if (this.args.model) {
      // get the model name
      const modelNameNormalized = actionName.toLowerCase()

      // hash with the data to use on the template
      const data = {
        modelName: modelNameNormalized,
        modelNameCapitalize: modelNameNormalized.charAt(0).toUpperCase() + modelNameNormalized.slice(1)
      }

      // process the template
      Utils.generateFileFromTemplate('actionCrud', data, outputPath)

      // print success message
      this.printSuccess(`The CRUD operations for the "${modelNameNormalized}" model was created!`)

      return true
    }

    // create the actions folder is not exists
    Utils.createFolderIfNotExists(actionsPath)

    // generate action file
    Utils.generateFileFromTemplate('action', { actionName: actionName }, outputPath)

    // print a success message
    this.printSuccess(`The "${actionName}" action was created!`)

    return true
  }
}

// export the function to execute the command
module.exports = args => (new MakeAction(args)).execute()
