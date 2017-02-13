'use strict'

// ----------------------------------------------------------------------------- [Imports]

let Command = require('../Command')
let Utils = require('../utils')

// ----------------------------------------------------------------------------- [Command]

class InitCommand extends Command {

  constructor () {
    // execute the super class constructor method
    super()

    // command description
    this.command = 'init'
    this.describe = 'Create a new Stellar project'
    this.builder = {
      name: {
        describe: 'Project name',
        require: true,
        type: 'string'
      },
      version: {
        describe: 'Project version',
        default: '1.0.0',
        type: 'string'
      },
      dockerIt: {
        describe: 'Create a dockerfile for the new project'
      }
    }
  }

  /**
   * Execute the command.
   *
   * we need to create:
   *  - /modules
   *  - /config
   *  - /manifest.json
   */
  run () {
    // check if is a empty folder
    if (!Utils.folderIsEmpty(process.cwd())) {
      this.printError('This command can only be executed when the directory is empty')
      return false
    }

    // create manifest.json file
    Utils.generateFileFromTemplate('manifest', {
      projectName: this.args.name,
      projectVersion: this.args.version
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
      require('./dockerIt').run()
    }

    // print a success message
    this.printSuccess(`The directory was initiated with a Stellar project structure.\nHappy Codding! 😉 🌟`)

    return true
  }
}

// export command
module.exports = new InitCommand()
