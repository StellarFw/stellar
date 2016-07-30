'use strict'

// ----------------------------------------------------------------------------------------------------------- [Imports]

let Command = require('../Command')
let Utils = require('../utils')

// ------------------------------------------------------------------------------------------------------------- [Class]

class MakeTask extends Command {

  /**
   * Create a new instance of this command.
   *
   * @param args  Arguments passed by console.
   */
  constructor (args) {
    // execute the super class constructor method
    super()

    // define usage
    this.usage = 'stellar makeTask <task_name> --module=<module_name> [--options]'

    // save the parsed console arguments
    this.args = args
  }

  /**
   * Execute the command
   */
  execute () {
    // we need to have the task name and the module name
    // here the action must be created
    if (this.args._.length < 2) {
      this.printUsage()
      return false
    }

    if (this.args.module === undefined || typeof this.args.module !== 'string' || this.args.module.length === 0) {
      this.printError('You need to specify the module here the task must be created')
      return false
    }

    // check if the module exists
    if (!Utils.moduleExists(this.args.module)) {
      this.printError(`The module "${this.args.module}" does not exists`)
      return false
    }

    // ensure the task folder exists
    let tasksFolder = `${Utils.getCurrentUniverse()}/modules/${this.args.module}/tasks`
    if (!Utils.exists(tasksFolder)) { Utils.createFolder(tasksFolder) }

    // build the output path
    let newFilePath = `${tasksFolder}/${this.args._[ 1 ]}.js`

    // generate the new file
    Utils.generateFileFromTemplate('task', { taskName: this.args._[ 1 ] }, newFilePath)

    // print a success message
    this.printSuccess(`The "${this.args._[ 1 ]}" task was created!`)

    return true
  }
}

// export the function to execute the command
module.exports = args => (new MakeTask(args)).execute()
