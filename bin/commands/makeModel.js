'use strict'

// ----------------------------------------------------------------------------- [Imports]

let Command = require('../Command')
let Utils = require('../utils')

// ----------------------------------------------------------------------------- [Class]

class MakeModel extends Command {

  /**
   * Create a new MakeModel instance.
   *
   * @param args
   */
  constructor (args) {
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
  execute () {
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

    // build module path
    const modulePath = `${Utils.getCurrentUniverse()}/modules/${this.args.module}`

    // ensure the models folder exists
    Utils.createFolder(`${modulePath}/models`)

    // build the new model file path
    let modelNameNormalized = this.args._[ 1 ].toLowerCase()
    let modelNameCapitalize = modelNameNormalized.charAt(0).toUpperCase() + modelNameNormalized.slice(1)
    let newFilePath = `${modulePath}/models/${modelNameNormalized}.js`

    // create the new model file
    Utils.createFile(newFilePath, Utils.getTemplate('model'))

    // print success message
    this.printSuccess(`The "${this.args._[ 1 ]}" model was created!`)

    // check if is to create an action file with the crud operations
    if (this.args.crud !== undefined) {
      // hash with the data to use on the template
      let data = {
        modelName: modelNameNormalized,
        modelNameCapitalize: modelNameCapitalize,
        rest: (this.args.rest !== undefined)
      }

      // build the output path
      let actionFilePath = `${modulePath}/actions/${modelNameNormalized}.js`

      // process the template
      Utils.generateFileFromTemplate('actionCrud', data, actionFilePath)

      // print success message
      this.printSuccess(`The CRUD operations for the "${this.args._[ 1 ]}" model was created!`)
    }

    // if the crud and rest options are present generate actions
    if (this.args.crud !== undefined && this.args.rest !== undefined) {
      let routes = {
        all: [],
        get: [],
        post: [],
        put: [],
        delete: []
      }

      // if the routes.json file exists load it
      if (Utils.exists(`${modulePath}/routes.json`)) { routes = require(`${modulePath}/routes.json`) }

      // add the new routes
      routes.get.push({ path: `/${modelNameNormalized}`, action: `get${modelNameCapitalize}s` })
      routes.get.push({ path: `/${modelNameNormalized}/:id`, action: `get${modelNameCapitalize}` })
      routes.post.push({ path: `/${modelNameNormalized}`, action: `create${modelNameCapitalize}` })
      routes.put.push({ path: `/${modelNameNormalized}/:id`, action: `edit${modelNameCapitalize}` })
      routes.delete.push({ path: `/${modelNameNormalized}/:id`, action: `remove${modelNameCapitalize}` })

      // save the new file
      Utils.createFile(`${modulePath}/routes.json`, JSON.stringify(routes, null, 2))

      // success
      this.printSuccess(`The routes for the "${this.args._[ 1 ]}" model was created!`)
    }

    return true
  }

}

// exports the function to execute the command
module.exports = args => (new MakeModel(args)).execute()
