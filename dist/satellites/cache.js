'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _async = require('async');

var _async2 = _interopRequireDefault(_async);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Cache manager class.
 *
 * This class provides an easy way for developers to make use of a cache system.
 */
var CacheManager = function () {

  /**
   * Constructor.
   *
   * @param api API reference.
   */


  /**
   * Lock name.
   *
   * @type {String}
   */


  /**
   * Lock key prefix.
   *
   * @type {String}
   */


  /**
   * API reference.
   *
   * @type {null}
   */
  function CacheManager(api) {
    _classCallCheck(this, CacheManager);

    this.api = null;
    this.redisPrefix = null;
    this.lockPrefix = null;
    this.lockDuration = null;
    this.lockName = null;
    this.lockRetry = 100;

    this.api = api;

    this.redisPrefix = api.config.general.cachePrefix;
    this.lockPrefix = api.config.general.lockPrefix;
    this.lockDuration = api.config.general.lockDuration;
    this.lockName = api.id;
  }

  // ----------------------------------------------------------------------------------------------------------- [Basic]

  /**
   * Get all cached keys.
   *
   * @param next  Callback.
   */


  /**
   * Lock interval to retry.
   *
   * @type {Number}
   */


  /**
   * Lock duration.
   *
   * @type {Number}
   */


  /**
   * Cache key prefix.
   *
   * @type {String}
   */


  _createClass(CacheManager, [{
    key: 'keys',
    value: function keys(next) {
      var self = this;
      self.api.redis.clients.client.keys(this.redisPrefix + '*', function (err, keys) {
        next(err, keys);
      });
    }

    /**
     * Get the total number of cached items.
     *
     * @param next  Callback.
     */

  }, {
    key: 'size',
    value: function size(next) {
      var self = this;

      // get all cached keys
      self.keys(function (err, keys) {
        var length = 0;

        // get the keys length if present
        if (keys) {
          length = keys.length;
        }

        next(err, length);
      });
    }

    /**
     * Remove all cached items.
     *
     * @param next  Callback.
     */

  }, {
    key: 'clear',
    value: function clear(callback) {
      var self = this;

      // get all cached keys
      self.keys(function (error, keys) {
        if (error && typeof callback === 'function') {
          return callback(error);
        }

        // array with the jobs to be done
        var jobs = [];

        // iterate all keys and push a new jobs for the array
        keys.forEach(function (key) {
          return jobs.push(function (done) {
            return self.api.redis.clients.client.del(key, done);
          });
        });

        // execute all the jobs, this can be done in parallel
        _async2.default.parallel(jobs, function (error) {
          if (typeof callback === 'function') {
            return callback(error);
          }
        });
      });
    }

    /**
     * Save a new cache entry.
     *
     * @param key           Key to be saved.
     * @param value         Value to associate with the key.
     * @param expireTimeMS  Expire time in milliseconds.
     * @param callback      Callback function.
     */

  }, {
    key: 'save',
    value: function save(key, value, expireTimeMS, callback) {
      var self = this;

      if (typeof expireTimeMS === 'function' && typeof callback === 'undefined') {
        callback = expireTimeMS;
        expireTimeMS = null;
      }

      var expireTimeSeconds = null;
      var expireTimestamp = null;

      // if expireTimeMS is different than null we calculate the expire time in seconds
      // and the expire timestamp
      if (expireTimeMS !== null) {
        expireTimeSeconds = Math.ceil(expireTimeMS / 1000);
        expireTimestamp = new Date().getTime() + expireTimeMS;
      }

      // build the cache object
      var cacheObj = {
        value: value,
        expireTimestamp: expireTimestamp,
        createdAt: new Date().getTime(),
        readAt: null
      };

      // check if the key are locked
      self.checkLock(key, null, function (error, lockOk) {
        if (error || lockOk !== true) {
          if (typeof callback === 'function') {
            callback(new Error('Object locked'));
          }
        } else {
          (function () {
            // save the new key and value
            var keyToSave = self.redisPrefix + key;
            self.api.redis.clients.client.set(keyToSave, JSON.stringify(cacheObj), function (err) {
              // if the new cache entry has been saved define the expire date if needed
              if (err === null && expireTimeSeconds) {
                self.api.redis.clients.client.expire(keyToSave, expireTimeSeconds);
              }

              // execute the callback
              if (typeof callback === 'function') {
                process.nextTick(function () {
                  callback(err, true);
                });
              }
            });
          })();
        }
      });
    }

    /**
     * Get a cache entry by their key.
     *
     * @param key       Key to search.
     * @param options   Call options.
     * @param next      Callback function.
     */

  }, {
    key: 'load',
    value: function load(key, options, next) {
      var self = this;

      if (typeof options === 'function') {
        next = options;
        options = {};
      }

      // get the cache entry from redis server
      self.api.redis.clients.client.get(self.redisPrefix + key, function (err, cacheObj) {
        // log the error if exists
        if (err) {
          self.api.log(err, 'error');
        }

        // try parse the redis response
        try {
          cacheObj = JSON.parse(cacheObj);
        } catch (e) {}

        // check if the object exist
        if (!cacheObj) {
          if (typeof next === 'function') {
            process.nextTick(function () {
              next(new Error('Object not found'), null, null, null, null);
            });
          }
        } else if (cacheObj.expireTimestamp >= new Date().getTime() || cacheObj.expireTimestamp === null) {
          (function () {
            var lastReadAt = cacheObj.readAt;
            var expireTimeSeconds = void 0;

            // update the readAt property
            cacheObj.readAt = new Date().getTime();

            if (cacheObj.expireTimestamp) {
              // define the new expire time if requested
              if (options.expireTimeMS) {
                cacheObj.expireTimestamp = new Date().getTime() + options.expireTimeMS;
                expireTimeSeconds = Math.ceil(options.expireTimeMS / 1000);
              } else {
                expireTimeSeconds = Math.floor((cacheObj.expireTimestamp - new Date().getTime()) / 1000);
              }
            }

            // check the cache entry lock
            self.checkLock(key, options.retry, function (err, lockOk) {
              if (err || lockOk !== true) {
                if (typeof next === 'function') {
                  next(new Error('Object locked'));
                }
              } else {
                self.api.redis.clients.client.set(self.redisPrefix + key, JSON.stringify(cacheObj), function (err) {
                  if (typeof expireTimeSeconds === 'number') {
                    self.api.redis.clients.client.expire(self.redisPrefix + key, expireTimeSeconds);
                  }
                  if (typeof next === 'function') {
                    process.nextTick(function () {
                      next(err, cacheObj.value, cacheObj.expireTimestamp, cacheObj.createdAt, lastReadAt);
                    });
                  }
                });
              }
            });
          })();
        } else {
          if (typeof next === 'function') {
            process.nextTick(function () {
              next(new Error('Object expired'), null, null, null, null);
            });
          }
        }
      });
    }

    /**
     * Destroy a cache entry.
     *
     * @param key   Key to destroy.
     * @param next  Callback.
     */

  }, {
    key: 'destroy',
    value: function destroy(key, next) {
      var self = this;

      // check cache entry lock
      self.checkLock(key, null, function (err, lockOk) {
        if (err || lockOk !== true) {
          if (typeof next === 'function') {
            next(new Error('Object locked'));
          }
        } else {
          self.api.redis.clients.client.del(self.redisPrefix + key, function (err, count) {
            if (err) {
              self.api.log(err, 'error');
            }
            var resp = true;
            if (count !== 1) {
              resp = false;
            }
            if (typeof next === 'function') {
              next(null, resp);
            }
          });
        }
      });
    }

    // ------------------------------------------------------------------------------------------------------------ [Lock]

    /**
     * Get all existing locks.
     *
     * @param next Callback function.
     */

  }, {
    key: 'locks',
    value: function locks(next) {
      var self = this;
      self.api.redis.clients.client.keys(this.lockPrefix + '*', function (err, keys) {
        next(err, keys);
      });
    }

    /**
     * Lock a cache entry.
     *
     * @param key           Key to lock.
     * @param expireTimeMS  Expire time (optional)
     * @param callback      Callback function.
     */

  }, {
    key: 'lock',
    value: function lock(key, expireTimeMS, callback) {
      var self = this;

      // if the expireTimeMS is a function that means the developer don't set a expire time
      if (typeof expireTimeMS === 'function' && callback === null) {
        callback = expireTimeMS;
        expireTimeMS = null;
      }

      // assign the default expire time if the expireTimeMS is equals to null
      if (expireTimeMS === null) {
        expireTimeMS = self.lockDuration;
      }

      // check the lock state
      self.checkLock(key, null, function (error, lock) {
        // if there is an error or the lock already exists
        if (error || lock !== true) {
          return callback(error, false);
        }

        // create a new lock
        var lockKey = self.lockPrefix + key;
        self.api.redis.clients.client.setnx(lockKey, self.lockName, function (error) {
          // return the error if exists
          if (error) {
            return callback(error);
          }

          // set an expire date for the lock
          self.api.redis.clients.client.expire(lockKey, Math.ceil(expireTimeMS / 1000), function (error) {
            lock = !error;
            return callback(error, lock);
          });
        });
      });
    }

    /**
     * Unlock a cache entry.
     *
     * @param key       Key to unlock.
     * @param callback  Callback function.
     */

  }, {
    key: 'unlock',
    value: function unlock(key, callback) {
      var self = this;

      // check the lock state, if already unlocked returns.
      self.checkLock(key, null, function (error, lock) {
        if (error || lock !== true) {
          return callback(error, false);
        }

        // remove the lock
        self.api.redis.clients.client.del(self.lockPrefix + key, function (error) {
          lock = true;
          if (error) {
            lock = false;
          }
          return callback(error, lock);
        });
      });
    }

    /**
     * Check if a cache entry is locked.
     *
     * @param key       Key to check.
     * @param retry     If defined keep retrying until the lock is free to be re-obtained.
     * @param callback      Callback function.
     * @param startTime This should not be used by the user.
     */

  }, {
    key: 'checkLock',
    value: function checkLock(key, retry, callback, startTime) {
      var self = this;

      // if the start time are not defined use the current timestamp
      if (startTime === null) {
        startTime = new Date().getTime();
      }

      // get the cache entry
      self.api.redis.clients.client.get(self.lockPrefix + key, function (error, lockedBy) {
        if (error) {
          return callback(error, false);
        } else if (lockedBy === self.lockName || lockedBy === null) {
          return callback(null, true);
        } else {
          // calculate the time variation between the request and the response
          var delta = new Date().getTime() - startTime;

          if (retry === null || retry === false || delta > retry) {
            return callback(null, false);
          }

          return setTimeout(function () {
            self.checkLock(key, retry, callback, startTime);
          }, self.lockRetry);
        }
      });
    }

    // ------------------------------------------------------------------------------------------------------------ [List]

    /**
     * Push a new object to a list.
     *
     * @param key       List key.
     * @param item      Item to cache.
     * @param callback  Callback function.
     */

  }, {
    key: 'push',
    value: function push(key, item, callback) {
      var self = this;

      // stringify the data to save
      var object = JSON.stringify({ data: item });

      // push the new item to Redis
      self.api.redis.clients.client.rpush(self.redisPrefix + key, object, function (error) {
        if (typeof callback === 'function') {
          callback(error);
        }
      });
    }

    /**
     * Pop a value from a list.
     *
     * If the key not exists a null value will be returned.
     *
     * @param key       Key to search for.
     * @param callback  Callback function.
     */

  }, {
    key: 'pop',
    value: function pop(key, callback) {
      var self = this;

      // pop the item from Redis
      self.api.redis.clients.client.lpop(self.redisPrefix + key, function (error, object) {
        // check if an error occurred during the request
        if (error) {
          return callback(error);
        }

        // if the object not exist return null
        if (!object) {
          return callback();
        }

        // try parse the item and return it
        var item = null;

        try {
          item = JSON.parse(object);
        } catch (e) {
          return callback(error);
        }

        // return the parsed object
        return callback(null, item.data);
      });
    }

    /**
     * Get the length of the list.
     *
     * @param key       Key to search for.
     * @param callback  Callback function.
     */

  }, {
    key: 'listLength',
    value: function listLength(key, callback) {
      var self = this;

      // request the list's length to Redis
      self.api.redis.clients.client.llen(self.redisPrefix + key, callback);
    }
  }]);

  return CacheManager;
}();

/**
 * Cache initializer.
 */


var _class = function () {
  function _class() {
    _classCallCheck(this, _class);

    this.loadPriority = 300;
  }

  /**
   * Initializer load priority
   *
   * @type {number}
   */


  _createClass(_class, [{
    key: 'load',


    /**
     * Initializer load method.
     *
     * @param api
     * @param next
     */
    value: function load(api, next) {
      // put cache manager available to all API
      api.cache = new CacheManager(api);

      // finish the initializer loading
      next();
    }
  }]);

  return _class;
}();

exports.default = _class;