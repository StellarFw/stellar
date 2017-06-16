'use strict'

exports.sleep = {
  name: 'sleep',
  description: 'This action sleep for a while and then return',

  inputs: {
    sleepDuration: {
      required: true,
      default: 1000
    }
  },

  outputExample: {
    sleepStarted: 1457265602,
    sleepEnded: 1457265615,
    sleepDelta: 13,
    sleepDuration: 10
  },

  run: (api, data, next) => {
    const sleepDuration = data.params.sleepDuration
    const sleepStarted = new Date().getTime()

    setTimeout(() => {
      let sleepEnded = new Date().getTime()
      let sleepDelta = sleepEnded - sleepStarted

      data.response.sleepStarted = sleepStarted
      data.response.sleepEnded = sleepEnded
      data.response.sleepDelta = sleepDelta
      data.response.sleepDuration = sleepDuration

      next()
    }, sleepDuration)
  }
}
