'use strict'

exports.promiseAction = {
  name: 'promiseAction',
  description: `This uses a promise to finish the action execution instead of a
    callback`,

  run (api, action) {
    return new Promise(resolve => {
      setTimeout(() => {
        action.response.success = `It's working!`
        resolve()
      }, 20)
    })
  }
}

exports.internalCallPromise = {
  name: 'internalCallPromise',
  description: `This calls another action and return a promise`,

  run (api, action) {
    return api.actions.call('formattedSum', { a: 4, b: 5 })
      .then(({ formatted }) => { action.response.result = formatted })
  }
}
