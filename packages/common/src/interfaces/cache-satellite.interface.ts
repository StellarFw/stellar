import { CacheObject } from ".";
import { Option, Result } from "..";

/**
 * Possible errors when interacting with the cache satellite.
 */
export enum CacheErrors {
  locked = "Object locked",
  notFound = "Object not found",
  expired = "Object expired",
  other = "Unexpected error",
}

/**
 * Options for the get operation.
 */
export interface CacheGetOptions {
  expireTimeMS: Option<number>;
  retry: false | number;
}

/**
 * Cache system.
 */
export interface ICacheSatellite {
  /**
   * Get a key from the cache.
   *
   * @param key
   */
  get<T>(key: string, options: Option<CacheGetOptions>): Promise<Result<CacheObject<T>, CacheErrors>>;

  /**
   * Save a new cache entry.
   *
   * @param key Key to be saved
   * @param value Value to associate with the key
   * @param expireTimeMS Expire time in milliseconds
   */
  set<T>(key: string, value: T, expireTimeMS: Option<number>): Promise<Result<boolean, CacheErrors>>;

  /**
   * Delete a cache entry.
   *
   * @param key key to be destroyed.
   */
  delete(key: string): Promise<Result<boolean, CacheErrors>>;

  /**
   * Remove all cached items.
   */
  clear<T>(): Promise<Array<T>>;

  /**
   * Get all cached keys
   */
  keys(): Promise<Array<string>>;

  /**
   * Get the total number of cached items
   */
  size(): Promise<number>;

  /**
   * Check if a cache entry is locked;
   *
   * @param key Key to check.
   * @param retry If defined keep retrying until the lock is free to be re-obtained.
   * @param startTime This should not be used by the user.
   */
  checkLock(key: string, retry: false | number, startTime?: Option<number>): Promise<boolean>;

  /**
   * Get all existing locks.
   */
  locks(): Promise<Array<string>>;

  /**
   * Lock a cache entry.
   *
   * @param key Key to be locked.
   * @param expireTimeMS Expire time.
   */
  lock(key: string, expireTimeMS: Option<number>): Promise<Result<boolean, string>>;

  /**
   * Unlock a cache entry.
   *
   * @param key Key to unlock
   */
  unlock(key: string): Promise<boolean>;

  /**
   * Push a new object to a list.
   *
   * @param key List key.
   * @param item Item to cache.
   */
  push<T>(key: string, item: T): Promise<void>;

  /**
   * Pop a value from a list.
   *
   * @param key Key to search for.
   */
  pop<T>(key: string): Promise<Option<T>>;

  /**
   * Get the length of the list.
   */
  listLength(key: string): Promise<number>;
}
