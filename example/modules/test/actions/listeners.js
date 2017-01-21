'use strict'

exports.default = {
  name: 'listenerTest',
  description: 'This action tests the event system',

  run (api, action) {
    return api.events.fire('example', { value: 'prev_value' })
    .then(response => { action.response.res = response })
  }
}
