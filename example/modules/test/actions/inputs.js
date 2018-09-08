module.exports = [ {
  name: 'input-require',
  description: 'Test input require property',

  inputs: {
    'value': {
      required: true
    }
  },

  run (api, action) {
    action.response.string = `Input > ${action.params.value}`
  }
}, {
  name: 'input-default',
  description: 'Test input default value',

  inputs: {
    'value': {
      default: 'DefaultVal'
    }
  },

  run (api, action) {
    action.response.string = `Input > ${action.params.value}`
  }
}, {
  name: 'input-default-function',
  description: `Test input default value using a function`,

  inputs: {
    value: {
      default (api) { return 156 }
    }
  },

  run (api, action) {
    action.response.value = action.params.value
  }
}, {
  name: 'input-validator-regex',
  description: 'Test input string validator',

  inputs: {
    'value': {
      validator: /^\d{3}$/
    }
  },

  run (api, action) {
    action.response.string = `Input > ${action.params.value}`
  }
}, {
  name: 'input-validator-function',
  description: 'Test input function validator',

  inputs: {
    'value': {
      validator: param => param === 'asd'
    }
  },

  run (api, action) {
    action.response.string = `Input > ${action.params.value}`
  }
}, {
  name: 'input-validator-predef-alpha',
  description: 'Test pre-defined validator alpha',

  inputs: {
    'value': {
      validator: 'alpha'
    }
  },

  run (api, action) {
    action.response.string = `Input > ${action.params.value}`
  }
}, {
  name: 'input-validator-predef-alpha-num',
  description: 'Test pre-defined validator alpha numeric',
  inputs: {
    'value': {
      description: 'value to be validated',
      validator: 'alpha_num'
    }
  },

  run (api, action) {
    action.response.string = `Input > ${action.params.value}`
  }
}, {
  name: 'input-validator-predef-test',
  description: 'Test pre-defined validator generic test',
  inputs: {
    'value': {
      validator: 'url'
    }
  },

  run (api, action) {
    action.response.string = `Input > ${action.params.value}`
  }
}, {
  name: 'input-validator-invalid',
  description: `This uses an invalid validator to test if the error message
    appears`,

  inputs: {
    'value': {
      validator: 'some_random_string'
    }
  },

  run (api, action) {
    action.response.string = `Input > ${action.params.value}`
  }
}, {
  name: 'input-validator-multiple',
  description: `Used to test multiple restrictions to the inputs`,

  inputs: {
    name: { validator: 'alpha' },
    phone: { validator: 'numeric' },
    someField: { validator: 'required_if:phone,123' }
  },

  run (api, action) {
    action.response.success = true
  }
}, {
  name: 'input-function-with-default',
  description: 'this action has some required params',
  version: 1,

  inputs: {
    requiredParam: { required: true },
    optionalParam: { required: false },
    fancyParam: {
      default: 'test123',

      validator (s) {
        if (s === undefined || s === 'test123') { return true }

        return `fancyParam should be 'test123'. so says ${this.id}`
      }
    }
  },

  run (api, connection) {
    connection.response.params = connection.params
  }
}]
