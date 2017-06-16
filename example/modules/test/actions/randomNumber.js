'use strict'

exports.randomNumber = {
  name: 'randomNumber',
  description: 'Generates a random number',

  outputExample: {
    number: 0.40420848364010453
  },

  run (api, action, next) {
    // generates a random number
    const number = Math.random()

    // save the generated number on the response object
    action.response.number = number

    // also adds a formatted string
    action.response.formatedNumber = `Your random number is ${number}`

    // finish the action execution
    next()
  }
}
