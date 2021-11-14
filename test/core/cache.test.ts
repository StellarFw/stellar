import { API, CacheErrors, none, some } from "@stellarfw/common/lib";
import { buildEngine } from "../test-utils";

describe("Core", () => {
  const engine = buildEngine();
  let api: API;

  beforeAll(async () => {
    await engine.start();
    api = engine.api;
  });
  afterAll(() => engine.stop());

  describe("Cache", () => {
    test("cache methods should exist", () => {
      expect(api.cache).toBeDefined();
      expect(api.cache.set).toBeDefined();
      expect(api.cache.get).toBeDefined();
      expect(api.cache.delete).toBeDefined();
    });

    test("set creates a new cache entry", () =>
      api.cache.set("testKey", "test123", none()).then((res) => expect(res).toBeTruthy()));

    test("get allows to get a cache entry", async () => {
      const res = await api.cache.get("testKey", none());
      expect(res.unwrap().value).toBe("test123");
    });

    test("get returns an Err when the cache key doesn't exist", async () => {
      const res = await api.cache.get("thisNotExists", none());
      expect(res.isErr()).toBeTruthy();
      expect(res.unwrapErr()).toBe(CacheErrors.notFound);
    });

    test("delete remove a cache entry", () => api.cache.delete("testKey").then((res) => expect(res).toBeTruthy()));

    test("delete failure", async () => expect((await api.cache.delete("testKey")).unwrap()).toBe(false));

    test("set with expire time", async () =>
      api.cache.set("testKey", "test123", some(10)).then((res) => expect(res.isOk()).toBeTruthy()));

    test("get with expired items should not return them", async () => {
      const saveRes = await api.cache.set("testKeyWait", "test123", some(10));

      expect(saveRes.isOk()).toBeTruthy();

      await api.utils.delay(20);
      const getRes = await api.cache.get("testKeyWait", none());
      expect(getRes.isErr());
      expect(getRes.containsErr(CacheErrors.expired)).toBeTruthy();
    });

    test("get with negative expire times will never load", async () => {
      await api.cache.set("testKeyInThePast", "test123", some(-1));

      const res = await api.cache.get("testKeyInThePast", none());
      expect(res.containsErr(CacheErrors.expired));
    });

    test("set does not need to pass expireTime", async () => {
      await api.cache.set("testKeyForNullExpireTime", "test123", none());

      const res = (await api.cache.get<string>("testKeyForNullExpireTime", none())).unwrap();
      expect(res.value).toBe("test123");
    });

    test("get without changing the expireTime will re-apply the redis expire", async () => {
      const key = "testKey";

      await api.cache.set(key, "val", some(1000));
      const res = await api.cache.get(key, none());
      expect(res.isOk()).toBeTruthy();
      expect(res.unwrap().value).toBe("val");

      await api.utils.delay(1001);
      const res2 = await api.cache.get(key, none());
      expect(res2.containsErr(CacheErrors.notFound)).toBeTruthy();
    });

    test("get with options that extending expireTime should return cached item", async () => {
      const timeout = 200;
      const expireTime = 400;
      const value = "test123";
      const key = "testKeyWait";

      // save the initial key
      await api.cache.set(key, value, some(expireTime));

      // wait for `timeout` and try to load the key with a extended expireTime
      await api.utils.delay(timeout);
      const resGet = await api.cache.get(key, some({ expireTimeMS: some(expireTime), retry: false }));
      expect(resGet.isOk()).toBeTruthy();
      expect(resGet.unwrap().value).toBe(value);

      // wait another `timeout` and load the key again without an extended expire time
      await api.utils.delay(timeout);
      const laterRes = await api.cache.get(key, none());
      expect(laterRes.unwrap().value).toBe(value);

      // wait another `timeout` and the key load should fail without the extended time
      await api.utils.delay(timeout);
      expect((await api.cache.get(key, none())).containsErr(CacheErrors.notFound)).toBeTruthy();
    });

    test("set works with arrays", async () => {
      (await api.cache.set("arrayKey", [1, 2, 3], none())).unwrap();

      const loadRes = (await api.cache.get<Array<number>>("arrayKey", none())).unwrap().value;

      expect(loadRes).toStrictEqual([1, 2, 3]);
    });

    test("set works with objects", async () => {
      const key = "objectKey";
      const data = {
        oneThing: "someData",
        otherThing: [1, 2, 3],
      };

      await api.cache.set(key, data, none());

      const loadRes = (await api.cache.get<typeof data>(key, none())).map((e) => e.value).unwrap();

      expect(loadRes.oneThing).toBe(data.oneThing);
      expect(loadRes.otherThing).toStrictEqual(data.otherThing);
    });

    test("can clear the cache entirely", async () => {
      await api.cache.set("cacheClearKey", 123, none());

      const count = await api.cache.size();
      expect(count).toBeGreaterThan(0);

      await api.cache.clear();
      return expect(await api.cache.size()).toBe(0);
    });

    describe("lists", () => {
      test("can push and pop from an array", async () => {
        await api.cache.push("testListKey", "a string");
        await api.cache.push("testListKey", ["an array"]);
        await api.cache.push("testListKey", { look: "an object" });

        expect((await api.cache.pop("testListKey")).unwrap()).toBe("a string");
        expect((await api.cache.pop("testListKey")).unwrap()).toStrictEqual(["an array"]);
        expect((await api.cache.pop("testListKey")).unwrap()).toStrictEqual({ look: "an object" });
      });

      test("will return null if the list is empty", async () =>
        expect((await api.cache.pop("emptyListKey")).isNone()).toBeTruthy());

      test("can get the length of an array when full", async () => {
        await api.cache.push("testListKeyTwo", "a string");

        expect(await api.cache.listLength("testListKeyTwo")).toBe(1);
      });

      test("will return 0 length when the key does not exist", async () =>
        expect(await api.cache.listLength("testListKeyNotExists")).toBe(0));
    });

    describe("locks", function () {
      const key = "testKey";

      // reset the lockName and unlock the key after each test
      afterEach(() => {
        // NOTE: this is only for tests
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (api.cache as any).lockName = api.id;
        return api.cache.unlock(key);
      });

      test("thing can be locked checked and unlocked", async () => {
        // lock a key
        expect(await (await api.cache.lock(key, some(100))).isOk()).toBeTruthy();

        // check the lock
        expect(await api.cache.checkLock(key, false, none())).toBeTruthy();

        // lock the key
        expect(await api.cache.unlock(key)).toBeTruthy();
      });

      test("locks have a TTL and the default will be assumed from config", async () => {
        // lock key
        await api.cache.lock(key, none());

        // check the lock TTL (Time To Live)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ttl = await api.redis.clients.client.ttl((api.cache as any).lockPrefix + key);
        expect(ttl).toBeLessThanOrEqual(10);
      });

      test("you can save an item if you do hold the lock", async () => {
        await api.cache.lock(key, none());
        return expect((await api.cache.set(key, "value", none())).isOk()).toBeTruthy();
      });

      test("you cannot save a locked item if you do not hold the lock", async () => {
        await api.cache.lock(key, none());

        // change the lock name
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (api.cache as any).lockName = "otherId";

        return expect((await api.cache.set(key, "someValue", none())).containsErr(CacheErrors.locked)).toBeTruthy();
      });

      test("you cannot destroy a locked item if you do not hold the lock", async () => {
        await api.cache.lock(key, none());

        // change the lock name
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (api.cache as any).lockName = "otherId";

        return expect((await api.cache.delete(key)).containsErr(CacheErrors.locked)).toBeTruthy();
      });
    });
  });
});
