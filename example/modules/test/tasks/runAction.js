'use strict'

exports.sayHello = {
  name: 'runAction',
  description: 'Run an action and return the connection object',
  queue: 'default',
  run: (api, params = {}, next) => {
    // execute the requested action
    api.actions.call(params.action, params, (error, response) => {
      // log the error if exists
      if (error) {
        api.log(`task error: ${error}`, 'error', {params: JSON.stringify(params)})
        return
      }

      // log the task call
      api.log(`[ action @ task ]`, 'debug', {params: JSON.stringify(params)})

      // execute the callback
      next(error, response)
    })
  }
}
