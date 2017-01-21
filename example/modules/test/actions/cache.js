'use strict'

module.exports = [ {
  name: 'cacheTest',
  description: 'I will test the internal cache function of the API',

  inputs: {
    key: {
      description: 'Key to store',
      required: true
    },
    value: {
      description: 'Value to store',
      required: true
    }
  },

  run: (api, data, next) => {
    let key = 'cache_test_' + data.params.key
    let value = data.params.value

    // create the base response object
    data.response.cacheTestResults = {}

    // create a new cache entry
    api.cache.save(key, value, 5000, (err, resp) => {
      // append the cache response to the request response
      data.response.cacheTestResults.saveResp = resp

      // get the cache size
      api.cache.size((err, numberOfCacheObjects) => {
        // append the cache size to the response object
        data.response.cacheTestResults.sizeResp = numberOfCacheObjects

        // load the cache entry
        api.cache.load(key, (err, resp, expireTimestamp, createdAt, readAt) => {
          // append the load response to the request response
          data.response.cacheTestResults.loadResp = {
            key: key,
            value: resp,
            expireTimestamp: expireTimestamp,
            createdAt: createdAt,
            readAt: readAt
          }

          // try destroy the cache entry
          api.cache.destroy(key, (err, resp) => {
            // append the response to the request response
            data.response.cacheTestResults.deleteResp = resp

            // finish the action execution
            next()
          })
        })
      })
    })
  }
} ]
