'use strict'

module.exports = [ {
  name: 'test',
  description: 'Just to test overwrite protection',

  run (engine, data, next) {
    // define a response var
    data.response.string = "overwrite"

    // end the action execution
    next()
  }
} ]
