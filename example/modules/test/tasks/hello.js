exports.sayHello = {
  name: 'sayHello',
  description: 'I say hello',

  queue: 'default',
  frequency: 1000,

  run (api, params, next) {
    api.log('hello', 'debug')

    next()
  }
}
