/**
 * Module dependencies
 */

var _       = require('lodash');
var program = require('commander');

// Allow us to display help(), but omit the wildcard (*) command.
program.Command.prototype.usageMinusWildcard =
program.usageMinusWildcard = function ()
{
    program.commands = _.reject(program.commands, {
        _name: '*'
    });

    program.help();
};

// Force program to display version information
program.Command.prototype.versionInformation =
program.versionInformation = function()
{
    program.emit('version');
};

// Exports module
module.exports = program;