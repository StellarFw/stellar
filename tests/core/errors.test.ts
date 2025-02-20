import { afterAll, beforeAll, describe, test } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { buildTestEngine } from "../utils.ts";

describe("Core: Errors", () => {
	const engine = buildTestEngine();

	beforeAll(async () => {
		await engine.start();
	});

	afterAll(() => engine.stop());

	test("returns string errors properly", async () => {
		const response = await engine.api.actions.call("aNotExistingAction");

		await expect(response.unwrapErr()).toMatchObject({
			code: "004",
		});
	});

	describe("with error function", () => {
		let originalHandler: CallableFunction;

		beforeAll(() => {
			originalHandler = engine.api.config.errors as CallableFunction;
			engine.api.config.errors.unknownAction = () => new Error("error test");
		});

		afterAll(() => {
			engine.api.config.errors = originalHandler;
		});

		test("returns Error object properly", async () => {
			const response = await engine.api.actions.call("aNotExistingAction");
			await expect((response.unwrapErr() as Error).message).toBe("error test");
		});
	});

	describe("with a function that returns an object", () => {
		let originalHandler: CallableFunction;

		beforeAll(() => {
			originalHandler = engine.api.config.errors as CallableFunction;
			engine.api.config.errors.unknownAction = () => {
				return { code: "error160501" };
			};
		});

		afterAll(() => {
			engine.api.config.errors = originalHandler;
		});

		test("returns generic object properly", async () => {
			const response = await engine.api.actions.call("aNotExistingAction");

			await expect(response.unwrapErr()).toMatchObject({
				code: "error160501",
			});
		});
	});
});
