import { afterAll, afterEach, beforeAll, describe, test } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { buildTestEngine } from "../utils.ts";
import { isFunction, isObject } from "ramda-adjunct";

describe("Core: Cache", () => {
	const engine = buildTestEngine();

	beforeAll(async () => {
		await engine.start();
	});

	afterAll(() => engine.stop());

	test("cache methods should exist", () => {
		expect(isObject(engine.api.cache)).toBeTruthy();
		expect(isFunction(engine.api.cache.save)).toBeTruthy();
		expect(isFunction(engine.api.cache.load)).toBeTruthy();
		expect(isFunction(engine.api.cache.destroy)).toBeTruthy();
	});

	test("cache.save", async () => {
		await expect(engine.api.cache.save("testKey", "test123", null)).resolves.toBeTruthy();
	});

	test("cache.load", async () => {
		await expect(engine.api.cache.load("testKey")).resolves.toMatchObject({
			value: "test123",
		});
	});

	test("cache.load failure", async () => {
		expect(engine.api.cache.load("thisNotExists")).rejects.toThrow("Object not found");
	});

	test("cache.destroy", async () => expect(engine.api.cache.destroy("testKey")).resolves.toBeTruthy());

	test("cache.destroy failure", async () => expect(engine.api.cache.destroy("testKey")).resolves.toBeFalsy());

	test("cache.save with expire time", async () =>
		expect(engine.api.cache.save("testKey", "test123", 10)).resolves.toBeTruthy());

	test("cache.load with expired items should not return them", async () => {
		await expect(engine.api.cache.save("testKeyWait", "test123", 10)).resolves.toBeTruthy();

		await engine.api.utils.delay(20);
		await expect(engine.api.cache.load("testKeyWait")).rejects.toThrow("Object expired");
	});

	test("cache.load with negative expire times will never load", async () => {
		await expect(engine.api.cache.save("testKeyInThePast", "test123", -1)).resolves.toBeTruthy();

		await expect(engine.api.cache.load("testKeyInThePast")).rejects.toThrow("Object expired");
	});

	test("cache.save does not need to pass expireTime", async () => {
		await expect(engine.api.cache.save("testKeyForNullExpireTime", "test123")).resolves.toBeTruthy();

		await expect(engine.api.cache.load("testKeyForNullExpireTime")).resolves.toMatchObject({ value: "test123" });
	});

	test("cache.load without changing the expireTime will re-apply the redis expire", async () => {
		const key = "testKey";

		await expect(engine.api.cache.save(key, "val", 1000)).resolves.toBeTruthy();
		await expect(engine.api.cache.load(key)).resolves.toMatchObject({ value: "val" });

		await engine.api.utils.delay(1001);
		await expect(engine.api.cache.load(key)).rejects.toThrow("Object not found");
	});

	test("cache.load with options that extending expireTime should return cached item", async () => {
		const timeout = 200;
		const expireTime = 400;
		const value = "test123";
		const key = "testKeyWait";

		// save the initial key
		await expect(engine.api.cache.save(key, value, expireTime)).resolves.toBeTruthy();

		// wait for `timeout` and try to load the key with a extended expireTime
		await engine.api.utils.delay(timeout);
		await expect(
			engine.api.cache.load(key, {
				expireTimeMS: expireTime,
			}),
		).resolves.toMatchObject({ value });

		// wait another `timeout` and load the key again without an extended expire time
		await engine.api.utils.delay(timeout);
		await expect(engine.api.cache.load(key)).resolves.toMatchObject({ value });

		// wait another `timeout` and the key load should fail without the extended time
		await engine.api.utils.delay(timeout);
		await expect(engine.api.cache.load(key)).rejects.toThrow("Object not found");
	});

	test("cache.save works with arrays", async () => {
		await expect(engine.api.cache.save("arrayKey", [1, 2, 3])).resolves.toBeTruthy();

		await expect(engine.api.cache.load("arrayKey")).resolves.toMatchObject({
			value: [1, 2, 3],
		});
	});

	test("cache.save works with objects", async () => {
		const key = "objectKey";
		const data = {
			oneThing: "someData",
			otherThing: [1, 2, 3],
		};

		await expect(engine.api.cache.save(key, data)).resolves.toBeTruthy();

		await expect(engine.api.cache.load(key)).resolves.toMatchObject({
			value: {
				oneThing: "someData",
				otherThing: [1, 2, 3],
			},
		});
	});

	test("can clear the cache entirely", async () => {
		await engine.api.cache.save("cacheClearKey", 123);

		await expect(engine.api.cache.size()).resolves.toBeGreaterThan(0);

		await engine.api.cache.clear();
		await expect(engine.api.cache.size()).resolves.toBe(0);
	});

	describe("lists", () => {
		test("can push and pop from an array", async () => {
			const jobs = [];

			jobs.push(engine.api.cache.push("testListKey", "a string"));
			jobs.push(engine.api.cache.push("testListKey", ["an array"]));
			jobs.push(engine.api.cache.push("testListKey", { look: "an object" }));

			// process the operations in parallel
			await expect(Promise.all(jobs)).resolves.toBeDefined();

			expect(engine.api.cache.pop("testListKey")).resolves.toBe("a string");
			expect(engine.api.cache.pop("testListKey")).resolves.toEqual(["an array"]);
			expect(engine.api.cache.pop("testListKey")).resolves.toEqual({
				look: "an object",
			});
		});

		test("will return null if the list is empty", async () =>
			expect(engine.api.cache.pop("emptyListKey")).resolves.toBeNull());

		test("can get the length of an array when full", async () => {
			await expect(engine.api.cache.push("testListKeyTwo", "a string")).resolves.toBeDefined();
			await expect(engine.api.cache.listLength("testListKeyTwo")).resolves.toBe(1);
		});

		test("will return 0 length when the key does not exist", async () =>
			expect(engine.api.cache.listLength("testListKeyNotExists")).resolves.toBe(0));
	});

	describe("locks", function () {
		const key = "testKey";

		// reset the lockName and unlock the key after each test
		afterEach(async () => {
			engine.api.cache.lockName = engine.api.id;
			await engine.api.cache.unlock(key);
		});

		test("thing can be locked checked and unlocked", async () => {
			// lock a key
			await expect(engine.api.cache.lock(key, 100)).resolves.toBeTruthy();

			// check the lock
			await expect(engine.api.cache.checkLock(key, null)).resolves.toBeTruthy();

			// lock the key
			await expect(engine.api.cache.unlock(key)).resolves.toBeTruthy();
		});

		test("locks have a TTL and the default will be assumed from config", async () => {
			// lock key
			await expect(engine.api.cache.lock(key, null)).resolves.toBeTruthy();

			// check the lock TTL (Time To Live)
			await expect(engine.api.redis.clients.client.ttl(engine.api.cache.lockPrefix + key)).resolves.toBeLessThanOrEqual(
				10,
			);
		});

		test("you can save an item if you do hold the lock", async () => {
			await expect(engine.api.cache.lock(key, null)).resolves.toBeTruthy();
			await expect(engine.api.cache.save(key, "value")).resolves.toBeTruthy();
		});

		test("you cannot save a locked item if you do not hold the lock", async () => {
			await expect(engine.api.cache.lock(key, null)).resolves.toBeTruthy();

			// change the lock name
			engine.api.cache.lockName = "otherId";

			await expect(engine.api.cache.save(key, "someValue")).rejects.toThrow("Object locked");
		});

		test("you cannot destroy a locked item if you do not hold the lock", async () => {
			await expect(engine.api.cache.lock(key, null)).resolves.toBeTruthy();

			// change the lock name
			engine.api.cache.lockName = "otherId";

			await expect(engine.api.cache.destroy(key)).rejects.toThrow("Object locked");
		});
	});
});
