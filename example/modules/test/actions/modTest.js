exports.modTest = {
  name: 'modTest',
  description: 'This action is used to test the action metadata manipulation',

  outputExample: {
    result: 'OK'
  },

  run (api, action, next) {
    action.response.result = action.actionTemplate.modProp
    next()
  }
}

exports.groupTest = {
  name: 'groupTest',
  description: 'This action is used to test the group definition directly on the action',

  // this is the property that are under testing, this can't be changed without
  // pay attention to other files.
  group: 'example',

  outputExample: {
    result: 'OK'
  },

  run (api, action, next) {
    action.response.result = action.actionTemplate.modProp
    next()
  }
}
