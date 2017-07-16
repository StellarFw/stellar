'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

/**
 * Cache manager class.
 *
 * This class provides an easy way for developers to make use of a cache system.
 */
class CacheManager {

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
  constructor(api) {
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
  keys() {
    var _this = this;

    return _asyncToGenerator(function* () {
      return _this.api.redis.clients.client.keys(_this.redisPrefix + '*');
    })();
  }

  /**
   * Get the total number of cached items.
   */
  size() {
    var _this2 = this;

    return _asyncToGenerator(function* () {
      let length = 0;

      // get all cached keys
      const keys = yield _this2.keys

      // get the keys length if present
      ();if (keys) {
        length = keys.length;
      }

      return length;
    })();
  }

  /**
   * Remove all cached items.
   */
  clear() {
    var _this3 = this;

    return _asyncToGenerator(function* () {
      // get all cached keys
      const keys = yield _this3.keys

      // array with the jobs to be done
      ();let jobs = [];

      // iterate all keys and push a new jobs for the array
      keys.forEach(function (key) {
        return jobs.push(_this3.api.redis.clients.client.del(key));
      }

      // execute all the jobs, this can be done in parallel
      );return Promise.all(jobs);
    })();
  }

  /**
   * Save a new cache entry.
   *
   * @param key           Key to be saved.
   * @param value         Value to associate with the key.
   * @param expireTimeMS  Expire time in milliseconds.
   */
  save(key, value, expireTimeMS = null) {
    var _this4 = this;

    return _asyncToGenerator(function* () {
      let expireTimeSeconds = null;
      let expireTimestamp = null;

      // if expireTimeMS is different than null we calculate the expire time in seconds and the expire timestamp
      if (expireTimeMS !== null) {
        expireTimeSeconds = Math.ceil(expireTimeMS / 1000);
        expireTimestamp = new Date().getTime() + expireTimeMS;
      }

      // build the cache object
      let cacheObj = {
        value: value,
        expireTimestamp: expireTimestamp,
        createdAt: new Date().getTime(),
        readAt: null

        // if the object is locked we throw an exception
      };const lockOk = yield _this4.checkLock(key, null);
      if (lockOk !== true) {
        throw new Error('Object locked');
      }

      // save the new key and value
      const keyToSave = _this4.redisPrefix + key;
      yield _this4.api.redis.clients.client.set(keyToSave, JSON.stringify(cacheObj)

      // if the new cache entry has been saved define the expire date if needed
      );if (expireTimeSeconds) {
        yield _this4.api.redis.clients.client.expire(keyToSave, expireTimeSeconds);
      }

      return true;
    })();
  }

  /**
   * Get a cache entry by their key.
   *
   * @param key       Key to search.
   * @param options   Call options.
   */
  load(key, options = {}) {
    var _this5 = this;

    return _asyncToGenerator(function* () {
      let cacheObj = null;

      try {
        // get the cache entry from redis server
        cacheObj = yield _this5.api.redis.clients.client.get(_this5.redisPrefix + key);
      } catch (e) {
        _this5.api.log(e, 'error');
      }

      // try parse the redis response
      try {
        cacheObj = JSON.parse(cacheObj);
      } catch (e) {}

      // check if the object exist
      if (!cacheObj) {
        throw new Error('Object not found');
      }

      if (cacheObj.expireTimestamp >= new Date().getTime() || cacheObj.expireTimestamp === null) {
        const lastReadAt = cacheObj.readAt;
        let expireTimeSeconds;

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
        let lockOk = null;
        try {
          lockOk = yield _this5.checkLock(key, options.retry);
        } catch (e) {
          throw new Error('Object locked');
        }

        if (lockOk !== true) {
          throw new Error('Object locked');
        }

        yield _this5.api.redis.clients.client.set(_this5.redisPrefix + key, JSON.stringify(cacheObj));

        if (typeof expireTimeSeconds === 'number') {
          yield _this5.api.redis.clients.client.expire(_this5.redisPrefix + key, expireTimeSeconds);
        }

        /// return an object with the last time that the resource was read and they content
        return {
          value: cacheObj.value,
          expireTimestamp: cacheObj.expireTimestamp,
          createdAt: cacheObj.createdAt,
          lastReadAt
        };
      }

      throw new Error('Object expired');
    })();
  }

  /**
   * Destroy a cache entry.
   *
   * @param key   Key to destroy.
   */
  destroy(key) {
    var _this6 = this;

    return _asyncToGenerator(function* () {
      let lockOk = null;

      try {
        // check cache entry lock
        lockOk = yield _this6.checkLock(key, null);
      } catch (e) {
        throw new Error('Object locked');
      }

      if (lockOk !== true) {
        throw new Error('Object locked');
      }

      let count = null;
      try {
        count = yield _this6.api.redis.clients.client.del(_this6.redisPrefix + key);
      } catch (e) {
        _this6.api.log(e, 'error');
      }

      return count === 1;
    })();
  }

  // ------------------------------------------------------------------------------------------------------------ [Lock]

  /**
   * Get all existing locks.
   */
  locks() {
    return this.api.redis.clients.client.keys(this.lockPrefix + '*');
  }

  /**
   * Lock a cache entry.
   *
   * @param key           Key to lock.
   * @param expireTimeMS  Expire time (optional)
   */
  lock(key, expireTimeMS = null) {
    var _this7 = this;

    return _asyncToGenerator(function* () {
      if (expireTimeMS === null) {
        expireTimeMS = _this7.lockDuration;
      }

      // when the resource is locked we can change the lock
      const lockOk = yield _this7.checkLock(key, null);
      if (!lockOk) {
        return false;
      }

      // create a new lock
      const lockKey = _this7.lockPrefix + key;
      yield _this7.api.redis.clients.client.setnx(lockKey, _this7.lockName

      // set an expire date for the lock
      );try {
        yield _this7.api.redis.clients.client.expire(lockKey, Math.ceil(expireTimeMS / 1000));
      } catch (e) {
        return false;
      }

      return true;
    })();
  }

  /**
   * Unlock a cache entry.
   *
   * @param key Key to unlock.
   */
  unlock(key) {
    var _this8 = this;

    return _asyncToGenerator(function* () {
      // check the lock state, if already unlocked returns.
      try {
        yield _this8.checkLock(key, null);
      } catch (e) {
        return false;
      }

      // remove the lock
      try {
        yield _this8.api.redis.clients.client.del(_this8.lockPrefix + key);
      } catch (e) {
        return false;
      }

      return true;
    })();
  }

  /**
   * Check if a cache entry is locked.
   *
   * @param key       Key to check.
   * @param retry     If defined keep retrying until the lock is free to be re-obtained.
   * @param startTime This should not be used by the user.
   */
  checkLock(key, retry, startTime = new Date().getTime()) {
    var _this9 = this;

    return _asyncToGenerator(function* () {
      // get the cache entry
      const lockedBy = yield _this9.api.redis.clients.client.get(_this9.lockPrefix + key

      // if the lock name is equals to this instance lock name, the resource can be used
      );if (lockedBy === _this9.lockName || lockedBy === null) {
        return true;
      }

      // calculate the time variation between the request and the response
      let delta = new Date().getTime() - startTime;

      if (retry === null || retry === false || delta > retry) {
        return false;
      }

      yield _this9.api.utils.deplay(_this9.lockRetry);
      return _this9.checkLock(key, retry, startTime);
    })();
  }

  // ------------------------------------------------------------------------------------------------------------ [List]

  /**
   * Push a new object to a list.
   *
   * @param key       List key.
   * @param item      Item to cache.
   */
  push(key, item) {
    // stringify the data to save
    let object = JSON.stringify({ data: item }

    // push the new item to Redis
    );return this.api.redis.clients.client.rpush(this.redisPrefix + key, object);
  }

  /**
   * Pop a value from a list.
   *
   * If the key not exists a null value will be returned.
   *
   * @param key       Key to search for.
   */
  pop(key) {
    var _this10 = this;

    return _asyncToGenerator(function* () {
      // pop the item from Redis
      const object = yield _this10.api.redis.clients.client.lpop(_this10.redisPrefix + key

      // if the object not exist return null
      );if (!object) {
        return null;
      }

      // try parse the item and return it
      let item = JSON.parse(object

      // return the parsed object
      );return item.data;
    })();
  }

  /**
   * Get the length of the list.
   *
   * @param key       Key to search for.
   */
  listLength(key) {
    return this.api.redis.clients.client.llen(this.redisPrefix + key);
  }
}

/**
 * Cache initializer.
 */
exports.default = class {
  constructor() {
    this.loadPriority = 300;
  }
  /**
   * Initializer load priority
   *
   * @type {number}
   */


  /**
   * Initializer load method.
   *
   * @param api
   * @param next
   */
  load(api, next) {
    // put cache manager available to all API
    api.cache = new CacheManager(api);

    // finish the initializer loading
    next();
  }
};