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
  static getCurrentUniverse () { return process.cwd() }

  /**
   * Check if a file/folder exists.
   *
   * @param path
   * @returns {boolean}
   */
  static exists (path) {
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
  static moduleExists (moduleName) {
    return this.exists(this.getCurrentUniverse() + `/modules/${moduleName}`)
  }

  /**
   * Create a file and write some content that file.
   *
   * @param path      Path where the file must be created.
   * @param content   Content to be written.
   * @returns {*}
   */
  static createFile (path, content) { return fs.writeFileSync(path, content) }

  /**
   * Read and return the file content.
   *
   * @param path    Path here the file must be read.
   * @returns {*}
   */
  static fileContent (path) { return fs.readFileSync(path).toString()}

  /**
   * Get the template file content.
   *
   * @param name    Template name to get.
   * @returns {*}
   */
  static getTemplate (name) {
    // build the full template path
    let path = `${__dirname}/templates/${name}.txt`

    // return the template content
    return Utils.fileContent(path)
  }

  /**
   * Check if a folder is empty.
   *
   * @param path        Path of the folder to be validated.
   * @returns {boolean} True if the folder is empty, false otherwise.
   */
  static folderIsEmpty (path) {
    let list = fs.readdirSync(path)
    list = list.filter(item => !(/(^|\/)\.[^\/\.]/g).test(item));

    return list.length <= 0
  }

  /**
   * Create a new directory.
   *
   * @param path
   */
  static createFolder (path) {
    try {
      fs.mkdirSync(path)
    } catch (e) {
      if (e.code != 'EEXIST') { throw e }
    }
  }
}

