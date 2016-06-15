exports.sayHello = {
  name: 'sayHello',
  description: 'I say hello',
  queue: 'default',
  frequency: 1000,
  run: function(api, params, next){
    api.log("hello")

    next()
  }
}
/*
exports.test = {
  name: 'example',
  description: '',
  frequency: 1000,
  run: function (api, params, next) {
    api.log('IVO!!!!')
    next()
  }
}
*/
