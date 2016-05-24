'use strict'

// ----------------------------------------------------------------------------------------------------------- [Imports]

let fs = require('fs')

// ------------------------------------------------------------------------------------------------------------- [Class]

module.exports = class Utils {
  /**
   * Get the current universe.
   *
   * @returns {*|String}
   */
  static getCurrentUniverse() { return process.cwd() }

  /**
   * Check if a file/folder exists.
   *
   * @param path
   * @returns {boolean}
   */
  static exists(path) {
    try {
      fs.accessSync(path, fs.F_OK)
      return true
    } catch (e) {}

    return false
  }

  /**
   * Check if the module exists in the current universe.
   *
   * @param moduleName
   * @returns {boolean}
   */
  static moduleExists(moduleName) {
    return this.exists(this.getCurrentUniverse() + `/modules/${moduleName}`)
  }

  /**
   * Create a file and write some content that file.
   *
   * @param path      Path where the file must be created.
   * @param content   Content to be written.
   * @returns {*}
   */
  static createFile(path, content) { return fs.writeFileSync(path, content) }

  /**
   * Read and return the file content.
   *
   * @param path    Path here the file must be read.
   * @returns {*}
   */
  static fileContent(path) { return fs.readFileSync(path).toString()}

  /**
   * Get the template file content.
   *
   * @param name    Template name to get.
   * @returns {*}
   */
  static getTemplate(name) {
    // build the full template path
    let path = `${__dirname}/templates/${name}.txt`

    // return the template content
    return Utils.fileContent(path)
  }
}

