'use strict'

module.exports = [ {
  name: 'versionedAction',
  description: 'Is just a dummy action with a version property',
  version: 1,
  run: (api, action, next) => {
    // finish the action execution
    next()
  }
}, {
  name: 'versionedAction',
  description: 'Is just a dummy action with a version property',
  version: 2,

  outputExample: {
    news: 'new version'
  },

  run: (api, action, next) => {
    // add a response property
    action.response.news = 'new version'

    // finish the action execution
    next()
  }
} ]
