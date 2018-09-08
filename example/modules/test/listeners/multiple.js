'use strict'

exports.default = {
  event: [
    'multiple',
    'multiple_two'
  ],
  description: `This event is used to test the multiple event support`,

  async run (params) {
    params.value += '_mod'
  }
}
