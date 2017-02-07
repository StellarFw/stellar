'use strict'

// ----------------------------------------------------------------------------------------------------------- [Imports]

let Command = require('../Command')
let Utils = require('../utils')

// ------------------------------------------------------------------------------------------------------------- [Class]

class InitCommand extends Command {

  constructor (args) {
    // execute the super class constructor method
    super()

    // save the parsed console arguments
    this.args = args
  }

  /**
   * Execute the command.
   *
   * we need to create:
   *  - /modules
   *  - /config
   *  - /manifest.json
   */
  execute () {
    // check if is a empty folder
    if (!Utils.folderIsEmpty(process.cwd())) {
      this.printError('This command can only be executed when the directory is empty')
      return false
    }

    // the developer need to specify the project names
    if (this.args.name === undefined || typeof this.args.name !== 'string') {
      this.printError('You need to specify the project name')
      this.printUsage()
      return false
    }

    // get project version (by default use 1.0.0)
    let projVersion = this.args.version || '1.0.0'

    // create manifest.json file
    Utils.generateFileFromTemplate('manifest', {
      projectName: this.args.name,
      projectVersion: projVersion
    }, `${process.cwd()}/manifest.json`)

    // create .gitignore file
    Utils.generateFileFromTemplate('gitignore', {}, `${process.cwd()}/.gitignore`)

    // create modules folder
    Utils.createFolder(process.cwd() + '/modules')
    let privateModulePath = process.cwd() + '/modules/private'
    Utils.createFolder(privateModulePath)
    Utils.createFile(`${privateModulePath}/manifest.json`, Utils.getTemplate('privateModule'))
    Utils.createFolder(`${privateModulePath}/actions`)
    Utils.createFolder(`${privateModulePath}/tasks`)
    Utils.createFolder(`${privateModulePath}/config`)

    // create config folder
    Utils.createFolder(process.cwd() + '/config')

    // check if we need create a dockerfile
    if (this.args.dockerIt !== undefined) {
      // luckily, we can execute the command directly
      require('./dockerIt')({})
    }

    // print a success message
    this.printSuccess(`The directory was initiated with a Stellar project structure.\nHappy Codding! 😉 🌟`)

    return true
  }

}

// -----------------------------------------------------------------------------

// command
exports.command = 'init'

// command description
exports.describe = 'Create a new Stellar project'

// command options
exports.builder = {
  name: {
    describe: 'Project name'
  },
  version: {
    describe: 'Project version',
    default: '1.0.0'
  },
  dockerIt: {
    describe: 'Create a dockerfile for the new project'
  }
}

// command handler
exports.handler = args => (new InitCommand(args)).execute()
