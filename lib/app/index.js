/**
 * Module dependencies.
 */

var Stellar = require('./Stellar');
var _       = require('lodash');

module.exports = StellarFactory;

function StellarFactory()
{
  return new Stellar();
}
