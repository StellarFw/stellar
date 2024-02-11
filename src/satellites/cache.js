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
  constructor(api) {
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
  async keys() {
    return this.api.redis.clients.client.keys(`${this.redisPrefix}*`);
  }

  /**
   * Get the total number of cached items.
   */
  async size() {
    let length = 0;

    // get all cached keys
    const keys = await this.keys();

    // get the keys length if present
    if (keys) {
      length = keys.length;
    }

    return length;
  }

  /**
   * Remove all cached items.
   */
  async clear() {
    // get all cached keys
    const keys = await this.keys();

    // array with the jobs to be done
    let jobs = [];

    // iterate all keys and push a new jobs for the array
    keys.forEach((key) => jobs.push(this.api.redis.clients.client.del(key)));

    // execute all the jobs, this can be done in parallel
    return Promise.all(jobs);
  }

  /**
   * Save a new cache entry.
   *
   * @param key           Key to be saved.
   * @param value         Value to associate with the key.
   * @param expireTimeMS  Expire time in milliseconds.
   */
  async save(key, value, expireTimeMS = null) {
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
      readAt: null,
    };

    // if the object is locked we throw an exception
    const lockOk = await this.checkLock(key, null);
    if (lockOk !== true) {
      throw new Error("Object locked");
    }

    // save the new key and value
    const keyToSave = this.redisPrefix + key;
    await this.api.redis.clients.client.set(
      keyToSave,
      JSON.stringify(cacheObj),
    );

    // if the new cache entry has been saved define the expire date if needed
    if (expireTimeSeconds) {
      await this.api.redis.clients.client.expire(keyToSave, expireTimeSeconds);
    }

    return true;
  }

  /**
   * Get a cache entry by their key.
   *
   * @param key       Key to search.
   * @param options   Call options.
   */
  async load(key, options = {}) {
    let cacheObj = null;

    try {
      // get the cache entry from redis server
      cacheObj = await this.api.redis.clients.client.get(
        this.redisPrefix + key,
      );
    } catch (e) {
      this.api.log(e, "error");
    }

    // try parse the redis response
    try {
      cacheObj = JSON.parse(cacheObj);
    } catch (e) {
      // ignore error
    }

    // check if the object exist
    if (!cacheObj) {
      throw new Error("Object not found");
    }

    if (
      cacheObj.expireTimestamp >= new Date().getTime() ||
      cacheObj.expireTimestamp === null
    ) {
      const lastReadAt = cacheObj.readAt;
      let expireTimeSeconds;

      // update the readAt property
      cacheObj.readAt = new Date().getTime();

      if (cacheObj.expireTimestamp) {
        // define the new expire time if requested
        if (options.expireTimeMS) {
          cacheObj.expireTimestamp =
            new Date().getTime() + options.expireTimeMS;
          expireTimeSeconds = Math.ceil(options.expireTimeMS / 1000);
        } else {
          expireTimeSeconds = Math.floor(
            (cacheObj.expireTimestamp - new Date().getTime()) / 1000,
          );
        }
      }

      // check the cache entry lock
      let lockOk = null;
      try {
        lockOk = await this.checkLock(key, options.retry);
      } catch (e) {
        throw new Error("Object locked");
      }

      if (lockOk !== true) {
        throw new Error("Object locked");
      }

      await this.api.redis.clients.client.set(
        this.redisPrefix + key,
        JSON.stringify(cacheObj),
      );

      if (typeof expireTimeSeconds === "number") {
        await this.api.redis.clients.client.expire(
          this.redisPrefix + key,
          expireTimeSeconds,
        );
      }

      /// return an object with the last time that the resource was read and they content
      return {
        value: cacheObj.value,
        expireTimestamp: cacheObj.expireTimestamp,
        createdAt: cacheObj.createdAt,
        lastReadAt,
      };
    }

    throw new Error("Object expired");
  }

  /**
   * Destroy a cache entry.
   *
   * @param key   Key to destroy.
   */
  async destroy(key) {
    let lockOk = null;

    try {
      // check cache entry lock
      lockOk = await this.checkLock(key, null);
    } catch (e) {
      throw new Error("Object locked");
    }

    if (lockOk !== true) {
      throw new Error("Object locked");
    }

    let count = null;
    try {
      count = await this.api.redis.clients.client.del(this.redisPrefix + key);
    } catch (e) {
      this.api.log(e, "error");
    }

    return count === 1;
  }

  // ------------------------------------------------------------------------------------------------------------ [Lock]

  /**
   * Get all existing locks.
   */
  locks() {
    return this.api.redis.clients.client.keys(`${this.lockPrefix}*`);
  }

  /**
   * Lock a cache entry.
   *
   * @param key           Key to lock.
   * @param expireTimeMS  Expire time (optional)
   */
  async lock(key, expireTimeMS = null) {
    if (expireTimeMS === null) {
      expireTimeMS = this.lockDuration;
    }

    // when the resource is locked we can change the lock
    const lockOk = await this.checkLock(key, null);
    if (!lockOk) {
      return false;
    }

    // create a new lock
    const lockKey = this.lockPrefix + key;
    await this.api.redis.clients.client.setnx(lockKey, this.lockName);

    // set an expire date for the lock
    try {
      await this.api.redis.clients.client.expire(
        lockKey,
        Math.ceil(expireTimeMS / 1000),
      );
    } catch (e) {
      return false;
    }

    return true;
  }

  /**
   * Unlock a cache entry.
   *
   * @param key Key to unlock.
   */
  async unlock(key) {
    // check the lock state, if already unlocked returns.
    try {
      await this.checkLock(key, null);
    } catch (e) {
      return false;
    }

    // remove the lock
    try {
      await this.api.redis.clients.client.del(this.lockPrefix + key);
    } catch (e) {
      return false;
    }

    return true;
  }

  /**
   * Check if a cache entry is locked.
   *
   * @param key       Key to check.
   * @param retry     If defined keep retrying until the lock is free to be re-obtained.
   * @param startTime This should not be used by the user.
   */
  async checkLock(key, retry, startTime = new Date().getTime()) {
    // get the cache entry
    const lockedBy = await this.api.redis.clients.client.get(
      this.lockPrefix + key,
    );

    // if the lock name is equals to this instance lock name, the resource can be used
    if (lockedBy === this.lockName || lockedBy === null) {
      return true;
    }

    // calculate the time variation between the request and the response
    let delta = new Date().getTime() - startTime;

    if (retry === null || retry === false || delta > retry) {
      return false;
    }

    await this.api.utils.deplay(this.lockRetry);
    return this.checkLock(key, retry, startTime);
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
    let object = JSON.stringify({ data: item });

    // push the new item to Redis
    return this.api.redis.clients.client.rpush(this.redisPrefix + key, object);
  }

  /**
   * Pop a value from a list.
   *
   * If the key not exists a null value will be returned.
   *
   * @param key       Key to search for.
   */
  async pop(key) {
    // pop the item from Redis
    const object = await this.api.redis.clients.client.lpop(
      this.redisPrefix + key,
    );

    // if the object not exist return null
    if (!object) {
      return null;
    }

    // try parse the item and return it
    let item = JSON.parse(object);

    // return the parsed object
    return item.data;
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
export default class {
  /**
   * Initializer load priority
   *
   * @type {number}
   */
  loadPriority = 300;

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
}
