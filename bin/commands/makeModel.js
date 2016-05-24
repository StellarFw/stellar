'use strict'

// ----------------------------------------------------------------------------------------------------------- [Imports]

let Command = require('../Command')
let Utils = require('../utils')

// ------------------------------------------------------------------------------------------------------------- [Class]

class MakeModel extends Command {

  /**
   * Create a new MakeModel instance.
   *
   * @param args
   */
  constructor(args) {
    // execute the super class constructor method
    super()

    // define usage
    this.usage = 'stellar makeModel <model_name> --module=<module_name> [--options]'

    // save the parsed console arguments
    this.args = args
  }

  /**
   * Execute the command.
   */
  execute() {
    // we need at least two arguments. One: the command name, two: the model name
    if (this.args._.length < 2) {
      this.printUsage()
      return false
    }

    // we need the module name here the model must be created
    if (this.args.module === undefined || typeof this.args.module !== 'string' || this.args.module.length === 0) {
      this.printError('You need to specify the module here the model must be created')
      return false
    }

    // check if the entered module name exists
    if (!Utils.moduleExists(this.args.module)) {
      this.printError(`The module "${this.args.module}" does not exists`)
      return false
    }

    // build the new model file path
    let modelNameNormalized = this.args._[ 1 ].toLowerCase()
    let newFilePath = Utils.getCurrentUniverse() + `/modules/${this.args.module}/models/${modelNameNormalized}.js`

    // create the new model file
    Utils.createFile(newFilePath, Utils.getTemplate('model'))

    // print success message
    this.printSuccess(`The "${this.args._[ 1 ]}" model was created!`)

    // check if is to create an action file with the crud operations
    if (this.args.crud !== undefined) {
      // get template
      let template = Utils.getTemplate('actionCrud')

      // capitalize model name
      let modelNameCapitalize = modelNameNormalized.charAt(0).toUpperCase() + modelNameNormalized.slice(1)

      // replace all the model names
      template = template.replace(/%ModelName%/g, modelNameCapitalize)
      template = template.replace(/%ModelNameLC%/g, modelNameNormalized)

      // create the new action file
      let actionFilePath = Utils.getCurrentUniverse() + `/modules/${this.args.module}/actions/${modelNameNormalized}.js`
      Utils.createFile(actionFilePath, template)

      // print success message
      this.printSuccess(`The CRUD operations for the "${this.args._[ 1 ]}" model was created!`)
    }

    return true
  }

}

// exports the function to execute the command
module.exports = args => (new MakeModel(args)).execute()
