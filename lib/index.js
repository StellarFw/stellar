/**
 * Module dependencies
 */

var Stellar = require('./app');

// Instantiate and expose a Stellar singleton
module.exports = new Stellar();

// Expose constructor for convenience/tests
module.exports.Stellar = Stellar;

// To access the Stellar app constructor, do:
// var Stellar = require('stellar').constructor;
// var newApp = new Stellar();

// Or to get a factory method which generates new instances:
// var Stellar = require('stellar/lib/app');
// var newApp = Stellar();
