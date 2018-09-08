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

  async run (_, action) {
    const sleepDuration = action.params.sleepDuration
    const sleepStarted = new Date().getTime()

    return new Promise(resolve => {
      setTimeout(() => {
        let sleepEnded = new Date().getTime()
        let sleepDelta = sleepEnded - sleepStarted
  
        action.response.sleepStarted = sleepStarted
        action.response.sleepEnded = sleepEnded
        action.response.sleepDelta = sleepDelta
        action.response.sleepDuration = sleepDuration
  
        resolve()
      }, sleepDuration)
    })
  }
}
