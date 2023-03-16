import { describe, expect, test } from "vitest";
import { always, identity, promisify, pipe, asyncAlways, mapPromise } from ".";

describe("functions", () => {
	test("identity always return the original value", () => {
		expect(identity(1)).toBe(1);
		expect(identity("a")).toBe("a");
	});

	test("always returns a function that always returns the original value", () => {
		expect(always(123)()).toBe(123);
	});

	test("asyncAlways returns a function that always returns the original value wrapped into a promise", async () => {
		expect(await asyncAlways(1)()).toBe(1);
	});

	describe("promisify", () => {
		test("when given a number returns a promise that resolves to the given number", async () => {
			expect(await promisify(1)).toBe(1);
		});

		test("when given a function it will return a promise version of the function", async () => {
			const testFn = () => 1;
			expect((await promisify(testFn))()).toBe(1);
		});
	});

	describe("pipe", () => {
		test("pipe chain unary functions from left-to-right", () => {
			const testPipe = pipe(
				(x: number) => x + 2,
				(x) => x * 2,
			);
			expect(testPipe(10)).toBe(24);
		});

		test("pipe can have a return type different from the input", () => {
			const testPipe = pipe<number, string>(
				(x: number) => x * 2,
				(x) => `is ${x}`,
			);

			expect(testPipe(2)).toBe("is 4");
		});
	});

	describe("mapPromise", () => {
		test("apply a map function to a promise value", () => {
			const val = Promise.resolve(130);
			const resultFn = mapPromise((v: number) => v + 70);

			expect(resultFn(val)).resolves.toEqual(200);
		});
	});
});
