exports.default = {

  tasks: function (api) {
    return {
      scheduler: true,
      maxTaskProcessors: 1,
      checkTimeout: 1000,
      redis: api.config.redis
    } 
  }
};
