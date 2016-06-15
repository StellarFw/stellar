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

  run: function (api, data, next) {
    var sleepDuration = data.params.sleepDuration
    var sleepStarted = new Date().getTime()

    setTimeout(function () {
      var sleepEnded = new Date().getTime()
      var sleepDelta = sleepEnded - sleepStarted

      data.response.sleepStarted = sleepStarted
      data.response.sleepEnded = sleepEnded
      data.response.sleepDelta = sleepDelta
      data.response.sleepDuration = sleepDuration

      next()
    }, sleepDuration)
  }
}