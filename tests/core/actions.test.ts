/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { buildEngine } from "../utils";

describe("Core: Actions", () => {
	const engine = buildEngine();

	beforeAll(async () => {
		await engine.start();
	});
	afterAll(async () => {
		await engine.stop();
	});

	test("can use a function to set a param default value", async () => {
		const responseRaw = await engine.api.actions.call<any, any, any>("inputDefaultFunction");
		expect(responseRaw.isOk()).toBeTruthy();
		expect(responseRaw.unwrap().value).toBe(156);
	});

	describe("can execute internally", () => {
		test("without params", async () => {
			expect((await engine.api.actions.call("formattedSum")).isErr()).toBeTruthy();
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
			const response = (await engine.api.actions.call<any, any>("groupTest")).unwrap();

			expect(response.result).toBe("OK");
		});

		test("support modules", async () => {
			const response = (await engine.api.actions.call<any, any>("modModuleTest")).unwrap();
			expect(response.result).toBe("OK");
		});

		test("support the actions property", async () => {
			const response = (await engine.api.actions.call<any, any>("modTest")).unwrap();
			expect(response.result).toBe("OK");
		});

		test("can add new items to an array", async () => {
			const response = (await engine.api.actions.call<any, any>("groupAddItems")).unwrap();
			expect(response.result).toEqual(["a", "b", "c"]);
		});

		test("can remove items from the array", async () => {
			const response = (await engine.api.actions.call<any, any>("groupRmItem")).unwrap();
			expect(Array.isArray(response.result)).toBeTruthy();
			expect(response.result.includes("a")).toBeTruthy();
			expect(response.result.includes("b")).toBeFalsy();
		});
	});

	describe("Timeout", () => {
		beforeAll(() => {
			engine.api.configs.general.actionTimeout = 100;
		});

		afterAll(() => {
			engine.api.configs.general.actionTimeout = 30000;
		});

		test("when the action exceed the config time in timeout", async () => {
			const response = await engine.api.actions.call("sleep", {
				sleepDuration: 150,
			});

			expect(response.isErr()).toBeTruthy();
		});

		test("throw a well formed error", async () => {
			const responseRaw = await engine.api.actions.call<any, any, { code: string; message: string }>("sleep", {
				sleepDuration: 150,
			});
			expect(responseRaw.isErr()).toBeTruthy();

			const error = responseRaw.unwrapErr();
			expect(error.code).toBe("022");
			expect(error.message).toBe("Response timeout for action 'sleep'");
		});
	});
});
