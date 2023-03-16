import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { buildEngine } from "../utils";

describe("Core", () => {
	const engine = buildEngine();

	beforeAll(async () => {
		await engine.start();
	});
	afterAll(async () => {
		await engine.stop();
	});

	describe("Errors", () => {
		test("returns string errors properly", async () => {
			const response = await engine.api.helpers.runAction("aNotExistingAction");

			expect(response.isErr()).toBeTruthy();
			expect(response.unwrapErr().code).toBe("004");
		});

		test("returns Error object properly", async () => {
			engine.api.configs.errors.unknownAction = () => new Error("error test");

			const response = await engine.api.helpers.runAction("aNotExistingAction");
			expect(response.isErr()).toBeTruthy();
			expect(response.unwrapErr().message).toBe("error test");
		});

		test("returns generic object properly", async () => {
			engine.api.configs.errors.unknownAction = () => ({ code: "error160501" });

			const response = await engine.api.helpers.runAction("aNotExistingAction");
			expect(response.isErr()).toBeTruthy();
			expect(response.unwrapErr().code).toBe("error160501");
		});
	});
});
