#!/usr/bin/env node

/**
 * Module dependencies
 */

var nodepath  = require('path');
var _         = require('lodash');
var package   = require('../package.json');
var Stellar   = require('../lib/app');
var Log       = require('log');

module.exports = function () {

  // create a debug instance
  var log = new Log();

  // load colors module
  require('colors');

  // log app start
  console.log();
  log.info('Starting Stellar System...'.magenta);
  console.log();

  // build initial scope
  var scope = {
    rootPath: process.cwd(),
    stellarPackageJSON: package
  };

  // run the app using the currently running version of Stellar.
  var stellar = Stellar();

  // start the environment
  stellar.bang(scope);

};
