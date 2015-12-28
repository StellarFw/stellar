import fs from 'fs';

export default class Utils {

  /**
   * Read all files from the given directory.
   *
   * @param dir         Folder path to search.
   * @returns {Array}   Array with the files paths.
     */
  static getFiles(dir) {
    var results = [];

    fs.readdirSync(dir).forEach(function (file) {
      file = `${dir}/${file}`;
      var stat = fs.statSync(file);

      if (stat && !stat.isDirectory()) {
        results.push(file);
      }
    });

    return results;
  }

}
