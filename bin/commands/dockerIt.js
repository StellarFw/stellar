'use strict'

// ----------------------------------------------------------------------------------------------------------- [Imports]

let Command = require('../Command')
let Utils = require('../utils')

// ------------------------------------------------------------------------------------------------------------- [Class]

class dockerItCommand extends Command {

  constructor (args) {
    // execute the super class constructor method
    super()

    // define usage
    this.usage = 'stellar dockerIt'

    // save the parsed console arguments
    this.args = args
  }

  /**
   * Execute the command.
   *
   */
  execute () {
    // see if a dockerfile already exists
    if (Utils.exists(process.cwd() + '/dockerfile')) {
      this.printError('A dockerfile already exists')
      return false
    }

    // create manifest.json file
    Utils.generateFileFromTemplate('dockerfile', {}, `${process.cwd()}/dockerfile`)

    // print a success message
    this.printSuccess(`A dockerfile was created in the project root.\nCreate the image with: docker build -t <image_name>\nCreate a container with: docker run -t -p 8080:8080 --name <container_name> <image_name>`)
  }
}

// export the function to execute the command
module.exports = args => (new dockerItCommand(args)).execute()
