var filesystem = require('fs');

/**
 * Get all folders of a folder.
 *
 * @param  {stirng} dir Folder path to search.
 * @return {array}      Array with the fodlers path.
 */
module.exports.getFolders = function (dir) {
    var results = [];

    filesystem.readdirSync(dir).forEach(function (file) {

        file = dir + '/' + file;
        var stat = filesystem.statSync(file);

        if (stat && stat.isDirectory()) {
            results.push(file);
        }
    });

    return results;
};

/**
 * Get all files of a folder.
 *
 * @param  {string} dir Folder path to search.
 * @return {array}      Array with the files paths.
 */
module.exports.getFiles = function (dir) {
    var results = [];

    filesystem.readdirSync(dir).forEach(function (file) {

        file = dir + '/' + file;
        var stat = filesystem.statSync(file);

        if (stat && !stat.isDirectory()) {
            results.push(file);
        }
    });

    return results;
};
