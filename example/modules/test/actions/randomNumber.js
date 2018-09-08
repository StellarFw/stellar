'use strict'

exports.randomNumber = {
  name: 'randomNumber',
  description: 'Generates a random number',

  outputExample: {
    number: 0.40420848364010453
  },

  async run (api, { response }) {
    const number = Math.random()

    response.number = number
    response.formatedNumber = `Your random number is ${number}`
  }
}
