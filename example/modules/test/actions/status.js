exports.status = {
  name: 'status',
  description: 'This action returns some basic information about the API',

  outputExample: {
    id: 'example',
    stellarVersion: '1.0.0',
    uptime: 10030
  },

  run: (api, data, next) => {
    data.response.id = api.id
    data.response.stellarVersion = api.stellarVersion
    data.response.uptime = new Date().getTime() - api.bootTime

    next()
  }
}
