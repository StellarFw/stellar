'use strict'

exports.sayHello = {
  name: 'runAction',
  description: 'Run an action and return the connection object',
  queue: 'default',
  run: (api, params = {}, next) => {
    // create a new connection object
    let connection = new api.connection(api, {
      type: 'task',
      remotePort: '0',
      remoteIP: '0',
      rawConnection: {}
    })

    // set the connection params
    connection.params = params

    // create a new ActionProcessor instance and execute then
    let actionProcessor = new api.actionProcessor(api, connection, data => {
      // log the error if exists
      if (data.response.error) {
        api.log(`task error: ${data.response.error}`, 'error', {params: JSON.stringify(params)})
        return
      }

      // log the task call
      api.log(`[ action @ task ]`, 'debug', {params: JSON.stringify(params)})

      // execute the callback on the connection destroy event
      connection.destroy(() => { next(data.response.error, data.response) })
    })

    // process the action
    actionProcessor.processAction()
  }
}
