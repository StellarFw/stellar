export default interface CacheObject {
  /**
   * Contains the value corresponding to the requested key, or null if
   * the record does not exist in the cache or has expired.
   */
  value: any;

  /**
   * Time in milliseconds that the object will expire (system time).
   */
  expireTimestamp?: number;

  /**
   * Time in milliseconds that the object was read for the last time via the
   * `api.cache.load method`
   *
   * It is useful to know if the  object has recently been read by another worker.
   */
  readAt?: number;

  /**
   * Time in milliseconds in which the object was created.
   */
  createdAt: number;
}
