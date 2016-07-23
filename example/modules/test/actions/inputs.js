'use strict'

module.exports = [ {
  name: 'input-require',
  description: 'Test input require property',
  inputs: {
    'value': {
      required: true
    }
  },
  run: (engine, data, next) => {
    data.response.string = "Input > " + data.params.value
    next()
  }
}, {
  name: 'input-default',
  description: 'Test input default value',
  inputs: {
    'value': {
      default: 'DefaultVal'
    }
  },
  run: (engine, data, next) => {
    data.response.string = "Input > " + data.params.value
    next()
  }
}, {
  name: 'input-validator-regex',
  description: 'Test input string validator',
  inputs: {
    'value': {
      validator: /^\d{3}$/
    }
  },
  run: (engine, data, next) => {
    data.response.string = "Input > " + data.params.value
    next()
  }
}, {
  name: 'input-validator-function',
  description: 'Test input function validator',
  inputs: {
    'value': {
      validator: (param) => param === 'asd'
    }
  },
  run: (engine, data, next) => {
    data.response.string = "Input > " + data.params.value
    next()
  }
}, {
  name: 'input-validator-predef-alpha',
  description: 'Test pre-defined validator alpha',
  inputs: {
    'value': {
      validator: 'alpha'
    }
  },

  run: (api, action, next) => {
    action.response.string = 'Input > ' + action.params.value
    next()
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

  run: (api, action, next) => {
    action.response.string = 'Input > ' + action.params.value
    next()
  }
}, {
  name: 'input-validator-predef-test',
  description: 'Test pre-defined validator generic test',
  inputs: {
    'value': {
      validator: 'url'
    }
  },

  run: (api, action, next) => {
    action.response.string = 'Input > ' + action.params.value
    next()
  }
} ]
