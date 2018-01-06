'use strict'

// ----------------------------------------------------------------------------- [Imports]

let Command = require('../Command')
let Utils = require('../utils')

// ----------------------------------------------------------------------------- [Command]

class dockerItCommand extends Command {

  constructor () {
    // execute the super class constructor method
    super(false)

    // command
    this.flags = 'dockerIt'
    this.desc = 'Create a new dockerfile for the stellar project'
  }

  /**
   * Execute the command.
   */
  exec () {
    // see if a dockerfile already exists
    if (Utils.exists(process.cwd() + '/dockerfile')) {
      this.printError('A dockerfile already exists')
      return false
    }

    // create manifest.json file
    Utils.generateFileFromTemplate('dockerfile', {}, `${process.cwd()}/dockerfile`)

    // print a success message
    this.printSuccess(`A dockerfile was created in the project root.\nCreate the image with: docker build -t <image_name> .\nCreate a container with: docker run -t -p 8080:8080 --name <container_name> <image_name>`)
  }
}

// -----------------------------------------------------------------------------

// export the command
module.exports = (new dockerItCommand())
