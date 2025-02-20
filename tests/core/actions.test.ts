import { afterAll, beforeAll, describe, test } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { buildTestEngine } from "../utils.ts";
import { sleep } from "../../src/utils.ts";

describe("Core: Actions", () => {
	const engine = buildTestEngine();

	beforeAll(async () => {
		await engine.start();
	});

	afterAll(() => engine.stop());

	test("can use a function to set a param default value", async () => {
		const responseRaw = await engine.api.actions.call<{ value: number }, unknown, unknown>("inputDefaultFunction");
		expect(responseRaw.isOk()).toBeTruthy();
		expect(responseRaw.unwrap().value).toBe(156);
	});

	describe("can execute internally", () => {
		test("returns an error with the missing parameters", async () => {
			const response = await engine.api.actions.call<unknown, { a: string; b: string }>("formattedSum");
			expect(response.isErr()).toBeTruthy();
			expect(response.unwrapErr()).toEqual({
				a: "The a field is required.",
				b: "The b field is required.",
			});
		});

		test("with all required parameters", async () => {
			expect((await engine.api.actions.call("formattedSum", { a: 3, b: 3 })).unwrap()).toStrictEqual({
				formatted: "3 + 3 = 6",
			});
		});
	});

	describe("Groups", () => {
		test("can read the group from an action", () => {
			expect(engine.api.actions.groupActions.has("example")).toBeTruthy();
		});

		test("the action name exists on the group", () => {
			const arrayOfAction = engine.api.actions.groupActions.get("example");

			expect(arrayOfAction).toContain("groupTest");
		});

		test("supports the group property", async () => {
			const response = (await engine.api.actions.call<{ result: string }, unknown>("groupTest")).unwrap();

			expect(response.result).toBe("OK");
		});

		test("support modules", async () => {
			const response = (await engine.api.actions.call<{ result: string }, unknown>("modModuleTest")).unwrap();
			expect(response.result).toBe("OK");
		});

		test("support the actions property", async () => {
			const response = (await engine.api.actions.call<{ result: string }, unknown>("modTest")).unwrap();
			expect(response.result).toBe("OK");
		});

		test("can add new items to an array", async () => {
			const response = (await engine.api.actions.call<{ result: string[] }>("groupAddItems")).unwrap();
			expect(response.result).toEqual(["a", "b", "c"]);
		});

		test("can remove items from the array", async () => {
			const response = (await engine.api.actions.call<{ result: string[] }>("groupRmItems")).unwrap();
			expect(Array.isArray(response.result)).toBeTruthy();
			expect(response.result.includes("a")).toBeTruthy();
			expect(response.result.includes("b")).toBeFalsy();
		});
	});

	describe("Timeout", () => {
		beforeAll(() => {
			engine.api.config.general.actionTimeout = 100;
		});

		afterAll(() => {
			engine.api.config.general.actionTimeout = 30000;
		});

		test("when the action exceed the config time in timeout", async () => {
			const response = await engine.api.actions.call("sleep", {
				sleepDuration: 150,
			});

			expect(response.isErr()).toBeTruthy();

			// ensure that we wait for the timer to be resolved, avoiding error with the deno test
			await sleep(150);
		});

		test("throw a well formed error", async () => {
			const responseRaw = await engine.api.actions.call<
				unknown,
				{ sleepDuration: number },
				{ code: string; message: string }
			>("sleep", {
				sleepDuration: 150,
			});
			expect(responseRaw.isErr()).toBeTruthy();

			const error = responseRaw.unwrapErr();
			expect(error.code).toBe("022");
			expect(error.message).toBe("Response timeout for action 'sleep'");

			// wait for the timer to be resolved to avoid errors with the deno test command
			await sleep(150);
		});
	});
});
