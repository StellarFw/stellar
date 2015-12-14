#!/usr/bin/env node

/**
 * Module dependencies.
 */

var _ = require('lodash');
var program = require('./_commander');
var package = require('../package.json');
var NOOP = function() {};

// Show stellar version
program
  .version(package.version, "-v, --version");

// ----------------------------------------
// Normalize version argument, i.e.
// ----------------------------------------
// $ stellar -v
// $ stellar -V
// $ stellar --version
// $ stellar version
// ----------------------------------------

// make `-v` option case-insensitive
program.argv = _.map(process.argv, function(arg) {
  return (arg === '-V') ? '-v' : arg;
});

// $ stellar version (--version synonym)
program
  .command('version')
  .description('show app version')
  .action(program.versionInformation);

program
  .option('--silent')
  .option('--verbose')
  .option('--silly')
  .unknownOption = NOOP;
program.usage('[command]');

// $ stellar run
var cmd;
cmd = program.command('run');
cmd.option('--prod');
cmd.option('--port [port]');
cmd.unknownOption = NOOP;
cmd.description('run the Stellar app');
cmd.action(require('./stellar-reactor'));

// $ stellar new <appname>
cmd = program.command('new [path_to_new_app]');
cmd.description('create a new Stellar app');
cmd.usage('[path_to_new_app]');
cmd.unknownOption = NOOP;
cmd.action(require('./stellar-new'));

// $ stellar newm <modulename>
cmd = program.command('newm [path_to_new_module]');
cmd.description('create a new Stellar module');
cmd.usage('[path_to_new_module]');
cmd.unknownOption = NOOP;
cmd.action(require('./stellar-new-module'));

// $ stellar generate <component>
cmd = program.command('generate');
cmd.description('generate a new module component');
cmd.unknownOption = NOOP;
cmd.usage('[something]');
cmd.action(require('./stellar-generate'));

// ----------------------------------------
// Normalize help argument, i.e.
// ----------------------------------------
// $ stellar --help
// $ stellar help
// $ stellar
// $ stellar <unrecognized_cmd>
// ----------------------------------------

// $ stellar help (--help synonym)
cmd = program.command('help');
cmd.description('show this info');
cmd.action(program.usageMinusWillcard);

// $ stellar <unrecognized_cmd>
// Mark the '*' in `help`.
program
  .command('*')
  .action(program.usageMinusWillcard);

// Don't balk at unknown options
program.unknownOption = NOOP;

// $ stellar
program.parse(process.argv);
var NO_COMMAND_SPECIFIED = program.args.length === 0;
if (NO_COMMAND_SPECIFIED) {
  program.usageMinusWildcard();
}
