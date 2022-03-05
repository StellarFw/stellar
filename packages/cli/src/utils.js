"use strict";

import fs from "fs";
import Handlebars from "handlebars";

export class Utils {
  /**
   * Get the current universe.
   *
   * @returns {*|String}
   */
  static getCurrentUniverse() {
    return process.cwd();
  }

  /**
   * read the manifest.json file to get the active modules and return them.
   */
  static getAppModules() {
    const manifest = Utils.fileContent(`${Utils.getCurrentUniverse()}/manifest.json`);
    return JSON.parse(manifest).modules || [];
  }

  /**
   * Check if a file/folder exists.
   *
   * @param path
   * @returns {boolean}
   */
  static exists(path) {
    try {
      fs.accessSync(path, fs.F_OK);
      return true;
    } catch (e) {}

    return false;
  }

  /**
   * Create a folder if not exists.
   *
   * @param path Path to check.
   */
  static createFolderIfNotExists(path) {
    if (!Utils.exists(path)) {
      Utils.createFolder(path);
    }
  }

  /**
   * Remove a directory.
   *
   * @param path   Directory path.
   */
  static removeDirectory(path) {
    let filesList;

    // get directory files
    try {
      filesList = fs.readdirSync(path);
    } catch (e) {
      return;
    }

    // iterate all folders and files on the directory
    filesList.forEach((file) => {
      // get full file path
      let filePath = `${path}/${file}`;

      // check if it's a file
      if (fs.statSync(filePath).isFile()) {
        fs.unlinkSync(filePath);
      } else {
        Utils.removeDirectory(filePath);
      }
    });

    // remove current directory
    fs.rmdirSync(path);
  }

  /**
   * Remove the object pointed by the path (file/directory).
   *
   * This function checks if the path exists before try remove him.
   *
   * @param path  Path to be removed.
   */
  static removePath(path) {
    // if the path don't exists return
    if (!Utils.exists(path)) {
      return;
    }

    // if the path is a file remote it and return
    if (fs.statSync(path).isFile()) {
      return fs.unlinkSync(path);
    }

    // remove all the directory content
    Utils.removeDirectory(path);
  }

  /**
   * Check if the module exists in the current universe.
   *
   * @param moduleName
   * @returns {boolean}
   */
  static moduleExists(moduleName) {
    return this.exists(this.getCurrentUniverse() + `/modules/${moduleName}`);
  }

  /**
   * Create a file and write some content that file.
   *
   * @param path      Path where the file must be created.
   * @param content   Content to be written.
   * @returns {*}
   */
  static createFile(path, content) {
    return fs.writeFileSync(path, content, "utf8");
  }

  /**
   * Read and return the file content.
   *
   * @param path    Path here the file must be read.
   * @returns {*}
   */
  static fileContent(path) {
    return fs.readFileSync(path).toString();
  }

  /**
   * Get the template file content.
   *
   * @param name    Template name to get.
   * @returns {*}
   */
  static getTemplate(name) {
    // build the full template path
    let path = `${__dirname}/templates/${name}.txt`;

    // return the template content
    return Utils.fileContent(path);
  }

  /**
   * Check if a folder is empty.
   *
   * @param path        Path of the folder to be validated.
   * @returns {boolean} True if the folder is empty, false otherwise.
   */
  static folderIsEmpty(path) {
    let list = fs.readdirSync(path);
    list = list.filter((item) => !/(^|\/)\.[^\/\.]/g.test(item));

    return list.length <= 0;
  }

  /**
   * Create a new directory.
   *
   * @param path
   */
  static createFolder(path) {
    try {
      fs.mkdirSync(path);
    } catch (e) {
      if (e.code !== "EEXIST") {
        throw e;
      }
    }
  }

  /**
   * Build a file using a template.
   *
   * This uses the handlebars template engine to build
   * the template. The `templateName` must be present
   * on the template folder.
   *
   * @param templateName  Template name
   * @param data          Data to use in the template
   * @param outputPath    Output file path
   */
  static generateFileFromTemplate(templateName, data, outputPath) {
    // get template source
    let templateSource = Utils.getTemplate(templateName);

    // compile template
    let template = Handlebars.compile(templateSource);

    // output the result to the outputPath
    Utils.createFile(outputPath, template(data));
  }
}
