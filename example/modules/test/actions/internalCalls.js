'use strict'

module.exports = [
  {
    name: 'sumANumber',
    description: 'Sum two integer numbers',
    inputs: {
      a: {
        description: 'First number',
        format: 'integer',
        required: true
      },
      b: {
        description: 'Second number',
        format: 'integer',
        required: true
      }
    },

    // disable documentation
    toDocument: false,

    // make this action private (this only can be called internally)
    private: true,

    run (api, action, next) {
      // make the sum calculation
      action.response.result = action.params.a + action.params.b

      // finish the action execution
      next()
    }
  },

  {
    name: 'formattedSum',
    description: 'Sum two numbers and return a formatted message with the result',
    inputs: {
      a: {
        description: 'First number',
        format: 'integer',
        required: true
      },
      b: {
        description: 'Second number',
        format: 'integer',
        required: true
      }
    },

    outputExample: {
      formatted: '3 + 3 = 6'
    },

    run (api, action) {
      // make a internal call to 'sumANumber' action
      return api.actions.call('sumANumber', action.params)
        .then(response => {
          // build a cool string
          action.response.formatted = `${action.params.a} + ${action.params.b} = ${response.result}`
        })
    }
  }
]
