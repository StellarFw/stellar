import fs from 'fs'
import Utils from '../utils'

/**
 * Cache manager class.
 *
 * This class provides an easy way for developers to make use of a cache system.
 */
class CacheManager {

  /**
   * API reference.
   *
   * @type {null}
   */
  api = null;

  /**
   * Cache key prefix.
   *
   * @type {String}
   */
  redisPrefix = null;

  /**
   * Lock key prefix.
   *
   * @type {String}
   */
  lockPrefix = null;

  /**
   * Lock duration.
   *
   * @type {Number}
   */
  lockDuration = null;

  /**
   * Lock name.
   *
   * @type {String}
   */
  lockName = null;

  /**
   * Lock interval to retry.
   *
   * @type {Number}
   */
  lockRetry = 100;

  /**
   * Constructor.
   *
   * @param api API reference.
   */
  constructor (api) {
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
  keys (next) {
    let self = this;
    self.api.redis.client.keys(this.redisPrefix + '*', (err, keys) => { next(err, keys); });
  }

  /**
   * Get all existing locks.
   *
   * @param next Callback function.
   */
  locks (next) {
    let self = this;
    self.api.redis.client.keys(this.lockPrefix + '*', (err, keys) => { next(err, keys); });
  }

  /**
   * Get the total number of cached items.
   *
   * @param next  Callback.
   */
  size (next) {
    let self = this;

    // get all cached keys
    self.keys((err, keys) => {
      let length = 0;

      // get the keys length if present
      if (keys) { length = keys.length; }

      next(err, length);
    });
  }

  /**
   * Remove all cached items.
   *
   * @param next  Callback.
   */
  clear (next) {
    let self = this;

    // get all cached keys
    self.keys((err, keys) => {
      if (keys.length > 0) {
        let started = 0;

        // iterate all cached keys and remove one by one
        keys.forEach((key) => {
          started++;
          self.del(key, (err) => {
            started--;
            if (started === 0 && typeof  next === 'function') { next(err, keys.length); }
          });
        });
      } else {
        if (typeof next === 'function') { next(err, keys.length); }
      }
    });
  }

  /**
   * Save a new cache entry.
   *
   * @param key           Key to be saved.
   * @param value         Value to associate with the key.
   * @param expireTimeMS  Expire time in milliseconds.
   * @param next          Callback function.
   */
  save (key, value, expireTimeMS, next) {
    let self = this;

    if (typeof expireTimeMS === 'function' && typeof next === 'undefined') {
      next = expireTimeMS;
      expireTimeMS = null;
    }

    let expireTimeSeconds = null;
    let expireTimestamp = null;

    // if expireTimeMS is different than null we calculate the expire time in seconds
    // and the expire timestamp
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
    };

    // check if the key are locked
    self.checkLock(key, null, (err, lockOk) => {
      if (err || lockOk !== true) {
        if (typeof next === 'function') { next(new Error('Object Locked')); }
      } else {
        // save the new key and value
        self.api.redis.client.set(self.redisPrefix + key, JSON.stringify(cacheObj), (err) => {
          // if the new cache entry has been saved define the expire date if needed
          if (err === null && expireTimeSeconds) {
            self.api.redis.client.expire(self.redisPrefix + key, expireTimeSeconds);
          }

          // execute the callback
          if (typeof next === 'function') { process.nextTick(() => { next(err, true); }) }
        });
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
  load (key, options, next) {
    let self = this;

    if (typeof options === 'function') {
      next = options;
      options = {};
    }

    // get the cache entry from redis server
    self.api.redis.client.get(self.redisPrefix + key, (err, cacheObj) => {
      // log the error if exists
      if (err) { self.api.log(err, 'error'); }

      // try parse the redis response
      try { cacheObj = JSON.parse(cacheObj); } catch (e) {}

      // check if the object exist
      if (!cacheObj) {
        if (typeof next === 'function') {
          process.nextTick(() => { next(new Error('Object not found'), null, null, null, null); })
        }
      } else if (cacheObj.expireTimestamp >= new Date().getTime() || cacheObj.expireTimestamp === null) {
        let lastReadAt = cacheObj.readAt;
        let expireTimeSeconds;

        // update the readAt property
        cacheObj.readAt = new Date().getTime();

        if (cacheObj.expireTimestamp) {
          // define the new expire time if requested
          if (options.expireTimeMS) {
            cacheObj.expireTimestamp = new Date().getTime() + options.expireTimeMS
            expireTimeSeconds = Math.ceil(options.expireTimeMS / 1000);
          } else {
            expireTimeSeconds = Math.floor((cacheObj.expireTimestamp - new Date().getTime()) / 1000);
          }
        }

        // check the cache entry lock
        self.checkLock(key, options.retry, (err, lockOk) => {
          if (err || lockOk !== true) {
            if (typeof next === 'function') { next(new Error('Object Locked')); }
          } else {
            self.api.redis.client.set(self.redisPrefix + key, JSON.stringify(cacheObj), (err) => {
              if (typeof expireTimeSeconds === 'number') {
                self.api.redis.client.expire(self.redisPrefix + key, expireTimeSeconds);
              }
              if (typeof next === 'function') {
                process.nextTick(function () { next(err, cacheObj.value, cacheObj.expireTimestamp, cacheObj.createdAt, lastReadAt); });
              }
            });
          }
        });
      } else {
        if (typeof next === 'function') {
          process.nextTick(() => { next(new Error('Object expired'), null, null, null, null); });
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
  destroy (key, next) {
    let self = this;

    // check cache entry lock
    self.checkLock(key, null, (err, lockOk) => {
      if (err || lockOk !== true) {
        if (typeof next === 'function') { next(new Error('Object Locked')); }
      } else {
        self.api.redis.client.del(self.redisPrefix + key, (err, count) => {
          if (err) { self.api.log(err, 'error'); }
          let resp = true;
          if (count !== 1) { resp = false; }
          if (typeof next === 'function') { next(null, resp); }
        });
      }
    });
  }

  // ------------------------------------------------------------------------------------------------------------ [Lock]

  /**
   * Check if a cache entry is locked.
   *
   * @param key       Key to check.
   * @param retry     If defined keep retrying until the lock is free to be re-obtained.
   * @param next      Callback function.
   * @param startTime This should not be used by the user.
   */
  checkLock (key, retry, next, startTime) {
    let self = this;

    // if the start time are not defined use the current timestamp
    if (startTime === null) { startTime = new Date().getTime(); }

    // get the cache entry
    self.api.redis.client.get(self.lockPrefix + key, (err, lockedBy) => {
      if (err) {
        next(err, false);
      } else if (lockedBy === self.lockName || lockedBy === null) {
        next(null, true);
      } else {
        // calculate the time variation between the request and the response
        let delta = new Date().getTime() - startTime;

        if (retry === null || retry === false || delta > retry) {
          next(null, false);
        } else {
          setTimeout(() => {
            self.checkLock(key, retry, next, startTime);
          }, self.lockRetry)
        }
      }
    });
  }
}

/**
 * Cache initializer.
 */
export default class {

  /**
   * Initializer load priority
   *
   * @type {number}
   */
  static loadPriority = 300;

  /**
   * Initializer load method.
   *
   * @param api
   * @param next
   */
  static load (api, next) {
    // put cache manager available to all API
    api.cache = new CacheManager(api);

    // finish the initializer loading
    next();
  }

}
