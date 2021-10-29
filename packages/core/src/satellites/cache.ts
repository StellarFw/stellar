import { Satellite } from "@stellarfw/common/lib/satellite";
import CacheObject from "@stellarfw/common/lib/interfaces/cache-object.interface";
import { LogLevel } from "@stellarfw/common/lib/enums/log-level.enum";

/**
 * Satellite to manage the cache.
 *
 * This Satellite provides an easy way for developers to make use of
 * a cache system.
 */
export default class CacheSatellite extends Satellite {
  protected _name: string = "cache";
  public loadPriority: number = 300;

  /**
   * Cache key prefix.
   */
  private redisPrefix!: string;

  /**
   * Lock key prefix.
   */
  private lockPrefix!: string;

  /**
   * Lock duration.
   */
  private lockDuration!: number;

  /**
   * Lock name.
   */
  private lockName!: string;

  /**
   * Lock interval to retry.
   */
  private lockRetry: number = 100;

  /**
   * Redis client instance.
   *
   * TODO: assign a type for this property
   */
  private client: any = null;

  public async load(): Promise<void> {
    this.api.cache = this;

    this.redisPrefix = this.api.configs.general.cachePrefix;
    this.lockPrefix = this.api.configs.general.lockPrefix;
    this.lockDuration = this.api.configs.general.lockDuration;
    this.lockName = this.api.id;
  }

  /**
   * Get all cached keys.
   */
  public async keys(): Promise<Array<string>> {
    return this.client.keys(`${this.redisPrefix}*`);
  }

  /**
   * Get the total number of cached items.
   */
  public async size(): Promise<number> {
    let length = 0;

    const keys = await this.keys();
    if (keys) {
      length = keys.length;
    }

    return length;
  }

  /**
   * Remove all cached items.
   */
  public async clear(): Promise<Array<any>> {
    const jobs: Array<Promise<any>> = [];

    const keys = await this.keys();
    keys.forEach((key) => jobs.push(this.client.del(key)));
    return Promise.all(jobs);
  }

  /**
   * Save a new cache entry.
   *
   * @param key           Key to be saved.
   * @param value         Value to associate with the key.
   * @param expireTimeMS  Expire time in milliseconds.
   */
  public async set(key: string, value: any, expireTimeMS?: number) {
    let expireTimeSeconds: number | null = null;
    let expireTimestamp: number | undefined = undefined;

    // if expireTimeMS is different than null we calculate the expire time in seconds and the expire timestamp.
    if (expireTimeMS) {
      expireTimeSeconds = Math.ceil(expireTimeMS / 1000);
      expireTimestamp = new Date().getTime() + expireTimeMS;
    }

    // build the cache object
    const cacheObj: CacheObject = {
      value,
      expireTimestamp,
      createdAt: new Date().getTime(),
    };

    // if the object is locked we throw an exception
    const lockOk = await this.checkLock(key, false);
    if (lockOk !== true) {
      throw new Error("Object locked");
    }

    // save the new key and value
    const keyToSave = this.redisPrefix + key;
    await this.api.redis.clients.client.set(
      keyToSave,
      JSON.stringify(cacheObj)
    );

    // if the new cache entry has been saved define the expire date if needed
    if (expireTimeSeconds) {
      await this.client.expire(keyToSave, expireTimeSeconds);
    }

    return true;
  }

  /**
   * Get a cache entry by their key.
   *
   * @param key       Key to search.
   * @param options   Call options.
   */
  public async get(key: string, options: any = {}): Promise<CacheObject> {
    let cacheObj: any;

    try {
      // get the cache entry from redis server
      cacheObj = await this.client.get(this.redisPrefix + key);
    } catch (e) {
      this.api.log(e, LogLevel.Error);
    }

    try {
      cacheObj = JSON.parse(cacheObj);
    } catch (e) {}

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
            (cacheObj.expireTimestamp - new Date().getTime()) / 1000
          );
        }
      }

      // check entry lock
      let lockOk = null;
      try {
        lockOk = await this.checkLock(key, options.retry);
      } catch (e) {
        throw new Error("Object locked");
      }

      if (lockOk !== true) {
        throw new Error("Object locked");
      }

      await this.client.set(this.redisPrefix + key, JSON.stringify(cacheObj));

      if (typeof expireTimeSeconds === "number") {
        await this.client.expire(this.redisPrefix + key, expireTimeSeconds);
      }

      // Return an object with the last time that the resource was
      // read and they content.
      return {
        value: cacheObj.value,
        expireTimestamp: cacheObj.expireTimestamp,
        createdAt: cacheObj.createdAt,
        lastReadAt,
      } as CacheObject;
    }

    throw new Error("Object expired");
  }

  /**
   * Destroy a cache entry.
   *
   * @param key   Key to destroy.
   */
  public async delete(key: string): Promise<boolean> {
    let lockOk = null;

    try {
      lockOk = await this.checkLock(key, false);
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
      this.api.log(e, LogLevel.Error);
    }

    return count === 1;
  }

  /**
   * Check if a cache entry is locked.
   *
   * @param key Key to check.
   * @param retry If defined keep retrying until the lock is free to be re-obtained.
   * @param startTime This should not be used by the user.
   */
  public async checkLock(
    key: string,
    retry: boolean | number = false,
    startTime: number = new Date().getTime()
  ) {
    const lockedBy = await this.client.get(this.lockPrefix + key);

    // If the lock name is equals to this instance lock name, the resource
    // can be used
    if (lockedBy === this.lockName || lockedBy === null) {
      return true;
    }

    // Compute the time variation between the request and the response
    const delta = new Date().getTime() - startTime;

    if (retry === false || delta > retry) {
      return false;
    }

    await this.api.utils.deplay(this.lockRetry);
    return this.checkLock(key, retry, startTime);
  }

  /**
   * Get all existing locks.
   */
  public locks() {
    return this.api.redis.clients.client.keys(`${this.lockPrefix}*`);
  }

  /**
   * Lock a cache entry.
   *
   * @param key           Key to lock.
   * @param expireTimeMS  Expire time (optional)
   */
  public async lock(
    key: string,
    expireTimeMS: number | null = null
  ): Promise<boolean> {
    if (expireTimeMS === null) {
      expireTimeMS = this.lockDuration;
    }

    // when the resource is locked we can change the lock
    const lockOk = await this.checkLock(key);
    if (!lockOk) {
      return false;
    }

    // create a new lock
    const lockKey = this.lockPrefix + key;
    await this.client.setnx(lockKey, this.lockName);

    // set an expire date for the lock
    try {
      await this.client.expire(lockKey, Math.ceil(expireTimeMS / 1000));
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
  public async unlock(key: string): Promise<boolean> {
    // check the lock state, if already unlocked returns.
    try {
      await this.checkLock(key, false);
    } catch (e) {
      return false;
    }

    try {
      await this.client.del(this.lockPrefix + key);
    } catch (e) {
      return false;
    }

    return true;
  }

  /**
   * Push a new object to a list.
   *
   * @param key       List key.
   * @param item      Item to cache.
   */
  public push(key: string, item: any): Promise<void> {
    const object = JSON.stringify({ data: item });
    return this.api.client.rpush(this.redisPrefix + key, object);
  }

  /**
   * Pop a value from a list.
   *
   * If the key not exists a null value will be returned.
   *
   * @param key       Key to search for.
   */
  public async pop(key: string): Promise<any> {
    const object = await this.client.lpop(this.redisPrefix + key);

    if (!object) {
      return null;
    }

    const item = JSON.parse(object);
    return item.data;
  }

  /**
   * Get the length of the list.
   *
   * @param key       Key to search for.
   */
  public listLength(key: string) {
    return this.client.llen(this.redisPrefix + key);
  }
}
