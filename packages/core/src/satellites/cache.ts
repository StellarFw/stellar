import {
  Satellite,
  LogLevel,
  ICacheSatellite,
  Option,
  Result,
  CacheErrors,
  some,
  none,
  err,
  ok,
  CacheGetOptions,
  CacheObject,
  unsafeAsync,
  unsafe,
  always,
  identity,
} from "@stellarfw/common/lib";

/**
 * Satellite to manage the cache.
 *
 * This Satellite provides an easy way for developers to make use of a cache system.
 */
export default class CacheSatellite extends Satellite implements ICacheSatellite {
  protected _name = "cache";
  public loadPriority = 300;

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
  private lockRetry = 100;

  /**
   * Redis client instance.
   *
   * TODO: assign a type for this property
   */
  private get client() {
    return this.api.redis.clients.client;
  }

  public async load(): Promise<void> {
    this.api.cache = this;

    this.redisPrefix = this.api.configs.general.cachePrefix;
    this.lockPrefix = this.api.configs.general.lockPrefix;
    this.lockDuration = this.api.configs.general.lockDuration;
    this.lockName = this.api.id;
  }

  private parseCacheObject<T>(cacheEntry: Result<string | null, string>): Result<CacheObject<T>, string> {
    // TODO: extract to a util function or event to the Options namespace
    const convertToOption = (raw: { tag: "some" | "nome"; value: unknown }) =>
      raw.tag === "some" ? some(raw.value) : none();

    return cacheEntry.andThen((entry) => {
      if (entry === null) {
        return err("the value doesn't exist");
      }

      return unsafe(() => JSON.parse(entry)).map((val) => ({
        ...val,
        expireTimestamp: convertToOption(val.expireTimestamp),
        readAt: convertToOption(val.readAt),
      }));
    });
  }

  /**
   * Get all cached keys.
   */
  public async keys(): Promise<Array<string>> {
    return this.client.keys(`${this.redisPrefix}*`) ?? [];
  }

  /**
   * Get the total number of cached items.
   */
  public async size(): Promise<number> {
    return (await this.keys()).length;
  }

  /**
   * Remove all cached items.
   */
  public async clear<T>(): Promise<Array<T>> {
    return Promise.all((await this.keys()).map((key) => this.client.del(key)));
  }

  /**
   * Save a new cache entry.
   *
   * @param key           Key to be saved.
   * @param value         Value to associate with the key.
   * @param expireTimeMS  Expire time in milliseconds.
   */
  public async set<T>(key: string, value: T, expireTimeMS: Option<number>): Promise<Result<boolean, CacheErrors>> {
    // if expireTimeMS is some we calculate the expire time in seconds and the expire timestamp.
    const expireData = expireTimeMS.match({
      some: (val) => ({
        expireTimeSeconds: some(Math.ceil(val / 1000)),
        expireTimestamp: some(new Date().getTime() + val),
      }),
      none: () => ({ expireTimeSeconds: none<number>(), expireTimestamp: none<number>() }),
    });

    // build the cache object
    const cacheObj: CacheObject<T> = {
      value,
      expireTimestamp: expireData.expireTimestamp,
      readAt: none(),
      createdAt: new Date().getTime(),
    };

    // if the object is locked we throw an exception
    const lockOk = await this.checkLock(key, false);
    if (lockOk !== true) {
      return err(CacheErrors.locked);
    }

    // save the new key and value
    const keyToSave = this.redisPrefix + key;
    await this.api.redis.clients.client.set(keyToSave, JSON.stringify(cacheObj));

    // if the new cache entry has been saved define the expire date if needed
    expireData.expireTimeSeconds.tapSome(async (val) => await this.client.expire(keyToSave, val));

    return ok(true);
  }

  /**
   * Get a cache entry by their key.
   *
   * @param key       Key to search.
   * @param options   Call options.
   */
  public async get<T>(
    key: string,
    optionsParam: Option<CacheGetOptions>,
  ): Promise<Result<CacheObject<T>, CacheErrors>> {
    const options = optionsParam.match({
      some: identity,
      none: always<CacheGetOptions>({ expireTimeMS: none(), retry: false }),
    });

    // get the cache entry from redis server
    const rawEntryResult = await unsafeAsync<string | null>(() => this.client.get(this.redisPrefix + key));
    if (rawEntryResult.isErr()) {
      this.api.log(rawEntryResult.unwrapErr(), LogLevel.Error);
      return err(CacheErrors.other);
    }

    // check if the object exist
    const cacheObjResult = this.parseCacheObject<T>(rawEntryResult);
    if (cacheObjResult.isErr()) {
      return err(CacheErrors.notFound);
    }

    const origCacheObj: CacheObject<T> = cacheObjResult.unwrap();

    // check if the cache was expired
    if (origCacheObj.expireTimestamp.isSome() && origCacheObj.expireTimestamp.unwrap() < new Date().getTime()) {
      return err(CacheErrors.expired);
    }

    // check if the value is locked
    if ((await this.checkLock(key, options.retry)) === false) {
      return err(CacheErrors.locked);
    }

    // update the read time
    const updatedCacheObj: CacheObject<T> = {
      ...origCacheObj,
      readAt: some(new Date().getTime()),
    };

    // compute the expire time
    const expireTimeSeconds = origCacheObj.expireTimestamp.match<Option<number>>({
      none: none,
      some: (expireTimestamp) =>
        options.expireTimeMS.match({
          none: () => some(Math.floor((expireTimestamp - new Date().getTime()) / 1000)),
          some: (expireTimeMS) => {
            updatedCacheObj.expireTimestamp = some(new Date().getTime() + expireTimeMS);
            return some(Math.ceil(expireTimeMS / 1000));
          },
        }),
    });

    // update the cache entry with the updated readAt value
    await this.client.set(this.redisPrefix + key, JSON.stringify(updatedCacheObj));

    await expireTimeSeconds.map((expireTime) => this.client.expire(this.redisPrefix + key, expireTime));

    // Return an object with the last time that the resource was read and they content.
    return ok({
      ...updatedCacheObj,
      readAt: origCacheObj.readAt,
    });

    // if (cacheObj.expireTimestamp >= new Date().getTime() || cacheObj.expireTimestamp === null) {
    //   const lastReadAt = cacheObj.readAt;
    //   let expireTimeSeconds;

    //   // update the readAt property
    //   cacheObj.readAt = new Date().getTime();

    //   if (cacheObj.expireTimestamp) {
    //     // define the new expire time if requested
    //     if (options.expireTimeMS) {
    //       cacheObj.expireTimestamp = new Date().getTime() + options.expireTimeMS;
    //       expireTimeSeconds = Math.ceil(options.expireTimeMS / 1000);
    //     } else {
    //       expireTimeSeconds = Math.floor((cacheObj.expireTimestamp - new Date().getTime()) / 1000);
    //     }
    //   }

    //   await this.client.set(this.redisPrefix + key, JSON.stringify(cacheObj));

    //   if (typeof expireTimeSeconds === "number") {
    //     await this.client.expire(this.redisPrefix + key, expireTimeSeconds);
    //   }
    // }
  }

  /**
   * Destroy a cache entry.
   *
   * @param key   Key to destroy.
   * @returns Ok with true when the key is delete, or false otherwise. Err is only returned when something went wrong.
   */
  public async delete(key: string): Promise<Result<boolean, CacheErrors>> {
    const lockOk = await this.checkLock(key, false);

    if (!lockOk) {
      return err(CacheErrors.locked);
    }

    return (await unsafeAsync<number>(() => this.api.redis.clients.client.del(this.redisPrefix + key))).match({
      err: (e) => {
        this.api.log(e, LogLevel.Error);
        return err(CacheErrors.other);
      },
      ok: (count) => ok(count === 1),
    });
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
    retry: false | number,
    startTimeParam: Option<number> = none(),
  ): Promise<boolean> {
    // when is the first call to the function this is a None, so we must to assign the current timestamp
    const startTime = startTimeParam.orElse(() => some(new Date().getTime()));

    const lockedBy = await this.client.get(this.lockPrefix + key);

    // If the lock name is equals to this instance lock name, the resource can be used
    if (lockedBy === this.lockName || lockedBy === null) {
      return true;
    }

    // Compute the time variation between the request and the response
    const delta = startTime.map((val) => new Date().getTime() - val);

    if (retry === false || delta.unwrap() > retry) {
      return false;
    }

    await this.api.utils.delay(this.lockRetry);
    return this.checkLock(key, retry, startTime);
  }

  /**
   * Get all existing locks.
   */
  public locks(): Promise<Array<string>> {
    return this.api.redis.clients.client.keys(`${this.lockPrefix}*`) ?? [];
  }

  /**
   * Lock a cache entry.
   *
   * @param key           Key to lock.
   * @param expireTimeMS  Expire time (optional)
   */
  public async lock(key: string, expireTimeMSParam: Option<number>): Promise<Result<boolean, CacheErrors>> {
    // when the expire time isn't given we use the default one
    const expireTimeMS = expireTimeMSParam.orElse(() => some(this.lockDuration)).unwrap();

    // when the resource is locked we can't do nothing
    const lockOk = await this.checkLock(key, false);
    if (!lockOk) {
      return ok(false);
    }

    // create a new lock
    const lockKey = this.lockPrefix + key;
    await this.client.setnx(lockKey, this.lockName);

    // set an expire date for the lock
    return (await unsafeAsync(() => this.client.expire(lockKey, Math.ceil(expireTimeMS / 1000)))).match<
      Result<boolean, CacheErrors>
    >({
      err: () => err(CacheErrors.other),
      ok: () => ok(true),
    });
  }

  /**
   * Unlock a cache entry.
   *
   * @param key Key to unlock.
   */
  public async unlock(key: string): Promise<boolean> {
    // check the lock state, if already unlocked returns.
    const hasLock = await this.checkLock(key, false);
    if (!hasLock) {
      return false;
    }

    // remove the lock
    return (await unsafeAsync(() => this.client.del(this.lockPrefix + key))).match({
      err: always(false),
      ok: always(true),
    });
  }

  /**
   * Push a new object to a list.
   *
   * @param key       List key.
   * @param item      Item to cache.
   */
  public push<T>(key: string, item: T): Promise<void> {
    const object = JSON.stringify({ data: item });
    return this.client.rpush(this.redisPrefix + key, object);
  }

  /**
   * Pop a value from a list.
   *
   * If the key not exists a null value will be returned.
   *
   * @param key       Key to search for.
   */
  public async pop<T>(key: string): Promise<Option<T>> {
    const object = await this.client.lpop(this.redisPrefix + key);

    if (!object) {
      return none();
    }

    const item = JSON.parse(object);
    return some(item.data);
  }

  /**
   * Get the length of the list.
   *
   * @param key       Key to search for.
   */
  public listLength(key: string): Promise<number> {
    return this.client.llen(this.redisPrefix + key);
  }
}
