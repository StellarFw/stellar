'use strict'

/**
 * This is just an example to show the usage of a listener.
 */
exports.example = {
  event: 'example',
  run: (api, params, next) => {
    // change the param value to 'thisIsATest'
    params.value = 'thisIsATest'

    // finish event execution
    next()
  }
}
