'use strict'

// ----------------------------------------------------------------------------- [Imports]

let Command = require('../../Command')
let Utils = require('../../utils')

// ----------------------------------------------------------------------------- [Command]

class MakeModel extends Command {
  /**
   * Create a new MakeModel instance.
   */
  constructor () {
    // execute the super class constructor method
    super()

    // command definition
    this.group = 'Components:'
    this.flags = 'model <model_name>'
    this.desc = 'Create a new Model'
    this.paramsDesc = 'The name of the Model to create'
    this.setup = sywac => {
      sywac
        .boolean('--crud', { desc: 'Create a set of actions with the CRUD operations' })
        .string('--actionName <action_name>', { desc: 'Overwrite the action file name' })
        .boolean('--rest', { desc: 'Generate RESTfull URLs for the generated actions' })
        .outputSettings({ maxWidth: 99 })
    }
  }

  /**
   * Execute the command.
   */
  exec () {
    // we need the module name here the model must be created
    if (this.args.module.length === 0) {
      return this.printError('You need to specify the module where the model must be created')
    }

    // check if the entered module name exists
    if (!Utils.moduleExists(this.args.module)) {
      return this.printError(`The module "${this.args.module}" does not exists`)
    }

    // build module path
    const modulePath = `${Utils.getCurrentUniverse()}/modules/${this.args.module}`

    // ensure the models folder exists
    Utils.createFolder(`${modulePath}/models`)

    // build the new model file path
    let modelNameNormalized = this.args.model_name.toLowerCase()
    let modelNameCapitalize = modelNameNormalized.charAt(0).toUpperCase() + modelNameNormalized.slice(1)
    let newFilePath = `${modulePath}/models/${modelNameNormalized}.js`

    // create the new model file
    Utils.generateFileFromTemplate('model', {}, newFilePath)

    // print success message
    this.printSuccess(`The "${this.args.model_name}" model was created!`)

    // check if is to create an action file with the crud operations
    if (this.args.crud) {
      // hash with the data to use on the template
      let data = {
        modelName: modelNameNormalized,
        modelNameCapitalize: modelNameCapitalize,
        rest: (this.args.rest !== undefined)
      }

      // ensure the actions directory exists
      const actionsDirectoryPath = `${modulePath}/actions`
      Utils.createFolder(actionsDirectoryPath)

      // build the output path
      const actionFilePath = `${actionsDirectoryPath}/${modelNameNormalized}.js`

      // process the template
      Utils.generateFileFromTemplate('actionCrud', data, actionFilePath)

      // print success message
      this.printSuccess(`The CRUD operations for the "${this.args.model_name}" model was created!`)
    }

    // if the crud and rest options are present generate actions
    if (this.args.crud && this.args.rest) {
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
      this.printSuccess(`The routes for the "${this.args.model_name}" model was created!`)
    }
  }
}

// export command
module.exports = new MakeModel()
