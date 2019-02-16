import fs from 'fs'
import Handlebars from 'handlebars'

class DocumentationGenerator {
  /**
   * API reference object.
   *
   * @type {null}
   */
  api = null

  /**
   * Docs folder path.
   *
   * @type {string}
   */
  docsFolder = ''

  /**
   * Static folder path.
   *
   * @type {string}
   */
  staticFolder = ''

  /**
   * Constructor.
   *
   * @param api
   */
  constructor (api) {
    let self = this

    // save API reference object
    self.api = api

    // unsure the public folder exists
    this.api.utils.createFolder(self.api.config.general.paths.public)

    // build docs folder path
    self.docsFolder = `${self.api.config.general.paths.public}/docs`

    // build static folder path
    self.staticFolder = `${__dirname}/../../staticFiles/docs`
  }

  /**
   * Generate an array with all information needed to build the list of tasks.
   */
  _getTasksInformation () {
    // array to store all the tasks
    const tasks = []

    // iterate all registered tasks
    Object.keys(this.api.tasks.tasks).forEach(key => {
      const task = this.api.tasks.tasks[key]
      tasks.push({
        name: task.name,
        description: task.description || 'N/A',
        frequency: task.frequency || '-'
      })
    })

    return tasks
  }

  /**
   * Get all actions who have toDocument different than false.
   *
   * @returns {{}}  Actions to generate documentation.
   * @private
   */
  _getActionToGenerateDoc () {
    let self = this

    // array to store the actions
    let actions = {}

    // iterate all actions
    for (let actionName in self.api.actions.actions) {
      let count = 0

      actions[ actionName ] = {}

      // iterate all action versions
      for (let versionNumber in self.api.actions.actions[ actionName ]) {
        if (self.api.actions.actions[ actionName ][ versionNumber ].toDocument !== false) {
          count++
          actions[ actionName ][ versionNumber ] = self.api.actions.actions[ actionName ][ versionNumber ]
        }
      }

      if (count === 0) { delete actions[ actionName ] }
    }

    return actions
  }

  /**
   * Generate the documentation.
   */
  generateDocumentation () {
    let self = this

    // remove docs directory
    this.api.utils.removeDirectory(self.docsFolder)

    // create the directory again
    this.api.utils.createFolder(self.docsFolder)

    // get actions to generate documentation
    let actions = self._getActionToGenerateDoc()

    // object with the template data
    let data = { actions: Object.keys(actions) }

    // get base template
    let source = fs.readFileSync(`${self.staticFolder}/action.html`).toString()

    // iterate all loaded actions
    for (let actionName in actions) {
      // set action name
      data.actionName = actionName

      // initialize array
      data.actionVersions = []

      // iterate all versions
      for (let versionNumber in actions[ actionName ]) {
        // get action object
        let action = self._prepareActionToPrint(actions[ actionName ][ versionNumber ])

        // push the version number
        action.version = versionNumber

        // push the new action to the actionVersions array
        data.actionVersions.push(action)
      }

      // build the template
      let template = Handlebars.compile(source)

      // output the result to the temp folder
      fs.writeFileSync(`${self.docsFolder}/action_${actionName}.html`, template(data), 'utf8')
    }

    // build the index.html
    self._buildIndexFile()

    // copy resource files
    this._copyResourceFiles()
  }

  /**
   * Build the index.html file.
   *
   * @private
   */
  _buildIndexFile () {
    let self = this

    // build data object
    let data = {
      actions: Object.keys(self._getActionToGenerateDoc()),
      project: {}
    }
    data.project.name = self.api.config.name
    data.project.description = self.api.config.description
    data.project.version = self.api.config.version

    // append the tasks information
    data.tasks = this._getTasksInformation()

    // get template source
    let source = fs.readFileSync(`${self.staticFolder}/index.html`).toString()

    // compile source
    let template = Handlebars.compile(source)

    // save index.html file on final docs folder
    fs.writeFileSync(`${self.docsFolder}/index.html`, template(data), 'utf8')
  }

  /**
   * Prepare the action to be printed.
   *
   * @param action
   * @returns {{}}
   * @private
   */
  _prepareActionToPrint (action) {
    // create a new object with the data prepared to be printed
    let output = {}

    // action name
    output.name = action.name

    // action description
    output.description = action.description

    // action output example
    if (action.outputExample !== undefined) {
      output.outputExample = JSON.stringify(action.outputExample, null, 4)
    }

    // action inputs
    if (action.inputs !== undefined) {
      output.inputs = []

      // iterate all inputs
      Object.keys(action.inputs).forEach(inputName => {
        let newInput = {}
        let input = action.inputs[ inputName ]

        newInput.name = inputName
        newInput.description = input.description || 'N/A'
        newInput.default = input.default || 'N/A'

        newInput.validators = []

        if (!(input.required === undefined || input.required === false)) {
          newInput.validators.push({ type: 'required', value: 'required' })
        }

        // validators
        if (typeof input.validator === 'function') {
          newInput.validators.push({ type: 'function', value: 'function' })
        } else if (input.validator instanceof RegExp) {
          newInput.validators.push({ type: 'regex', value: String(input.validator) })
        } else if (typeof input.validator === 'string') {
          // the validator string can have many validators separated by '|', we need to split them
          let validators = input.validator.split('|')

          for (let index in validators) {
            newInput.validators.push({ type: 'validator', value: validators[ index ] })
          }
        }

        // push the new input
        output.inputs.push(newInput)
      })
    }

    return output
  }

  /**
   * Copy resource files to final docs folder.
   *
   * @private
   */
  _copyResourceFiles () {
    let self = this
    this.api.utils.copyFile(`${self.staticFolder}/reset.css`, `${self.docsFolder}/reset.css`)
    this.api.utils.copyFile(`${self.staticFolder}/style.css`, `${self.docsFolder}/style.css`)
    this.api.utils.copyFile(`${self.staticFolder}/highlight.js`, `${self.docsFolder}/highlight.js`)
  }
}

/**
 * This satellite is responsible to generate the documentation
 * for all project actions.
 */
export default class {
  /**
   * Satellite load priority.
   *
   * @type {number}
   */
  loadPriority = 710

  /**
   * Satellite loading function.
   *
   * @param api   API reference object.
   * @param next  Callback function.
   */
  load (api, next) {
    // if the documentation generation was disabled finish now
    if (api.config.general.generateDocumentation !== true) {
      next()
      return
    }

    // build the documentation
    (new DocumentationGenerator(api)).generateDocumentation()

    // finish the satellite loading
    next()
  }
}
