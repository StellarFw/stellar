'use strict'

// ----------------------------------------------------------------------------- [Imports]

let Command = require('../Command')
let Utils = require('../utils')

// ----------------------------------------------------------------------------- [Command]

class MakeTask extends Command {

  /**
   * Create a new instance of this command.
   */
  constructor () {
    // execute the super class constructor method
    super()

    // command
    this.command = 'task <task_name>'
    this.describe = 'Create a new Task'
    this.builder = {
      module: {
        describe: 'Module where the file will be created',
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
   * Execute the command
   */
  run () {
    if (this.args.module.length === 0) {
      return this.printError('You need to specify the module where the task must be created')
    }

    // check if the module exists
    if (!Utils.moduleExists(this.args.module)) {
      return this.printError(`The module "${this.args.module}" does not exists`)
    }

    // ensure the task folder exists
    let tasksFolder = `${Utils.getCurrentUniverse()}/modules/${this.args.module}/tasks`
    if (!Utils.exists(tasksFolder)) { Utils.createFolder(tasksFolder) }

    // get task name
    const taskName = this.args.task_name

    // build the output path
    let newFilePath = `${tasksFolder}/${taskName}.js`

    // generate the new file
    Utils.generateFileFromTemplate('task', { taskName }, newFilePath)

    // print a success message
    this.printSuccess(`The "${taskName}" task was created!`)
  }
}

// export command
module.exports = new MakeTask()
