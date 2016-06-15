module.exports = [{
  name: 'cacheTest',
  description: 'I will test the internal cache function of the API',

  inputs: {
    key: {
      require: true
    },
    value: {
      require: true
    }
  },

  run: function (api, data, next) {
    var key = 'cache_test_' + data.params.key;
    var value = data.params.value;

    // create the base response object
    data.response.cacheTestResults = {};

    // create a new cache entry
    api.cache.save(key, value, 5000, function (err, resp) {
      // append the cache response to the request response
      data.response.cacheTestResults.saveResp = resp;

      // get the cache size
      api.cache.size(function(err, numberOfCacheObjects) {
        // append the cache size to the response object
        data.response.cacheTestResults.sizeResp = numberOfCacheObjects;
        
        // load the cache entry
        api.cache.load(key, function (err, resp, expireTimestamp, createdAt, readAt) {
          // append the load response to the request response
          data.response.cacheTestResults.loadResp = {
            key: key,
            value: resp,
            expireTimestamp: expireTimestamp,
            createdAt: createdAt,
            readAt: readAt
          };

          // try destroy the cache entry
          api.cache.destroy(key, function (err, resp) {
            // append the response to the request response
            data.response.cacheTestResults.deleteResp = resp;

            // finish the action execution
            next();
          });
        });
      });
    });
  }
}]
