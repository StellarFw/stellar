exports.default = {

  tasks: function (api) {
    return {
      workerLogging: {
        success: 'debug',
        start: 'debug',
        end: 'debug'
      },

      scheduler: true,
      maxTaskProcessors: 1,
      checkTimeout: 1000,
      redis: api.config.redis
    }
  }
};
