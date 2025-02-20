import { afterAll, beforeAll, describe, test } from "@std/testing/bdd";
import { expect } from "@std/expect";

import { buildTestEngine, runActionPromise } from "../utils";
import { err, ok } from "../../src/common/fp/result/result.ts";
import { isObject } from "ramda-adjunct";

describe("Core: API", () => {
	const engine = buildTestEngine();

	beforeAll(async () => {
		await engine.start();
	});

	afterAll(() => engine.stop());

	test.only("should have an api object with proper parts", () => {
		[engine.api.actions.actions, engine.api.actions.versions].forEach((item) => expect(isObject(item)).toBeTruthy());

		expect(isObject(engine.api.config)).toBeTruthy();
	});

	describe("api versions", function () {
		beforeAll(() => {
			engine.api.actions.versions.versionedAction = [1, 2, 3];
			engine.api.actions.actions.versionedAction = {
				"1": {
					name: "versionedAction",
					description: "A test action",
					version: 1,
					run() {
						return ok({ version: 1 });
					},
				},
				"2": {
					name: "versionedAction",
					description: "A test action",
					version: 2,
					run() {
						return ok({ version: 2 });
					},
				},
				"3": {
					name: "versionedAction",
					description: "A test action",
					version: 3,
					run() {
						const complexError = {
							reason: { msg: "description" },
						};
						return err(complexError);
					},
				},
			};
		});

		afterAll(() => {
			delete engine.api.actions.actions.versionedAction;
			delete engine.api.actions.versions.versionedAction;
		});

		test("will default actions to version 1 when no version is provided", async () => {
			const response = await engine.api.actions.call("randomNumber");
			expect(response.requesterInformation.receivedParams.apiVersion).toBe(1);
		});

		test("can specify an apiVersion", async () => {
			const response1 = await runActionPromise(api, "versionedAction", {
				apiVersion: 1,
			});
			expect(response1.requesterInformation.receivedParams.apiVersion).toBe(1);

			const response2 = await runActionPromise(api, "versionedAction", {
				apiVersion: 2,
			});
			expect(response2.requesterInformation.receivedParams.apiVersion).toBe(2);
		});

		test("will default clients to the latest version of the action", async () => {
			return expect(
				engine.api.helpers.runAction("versionedAction", {}),
			).resolves.toMatchObject({
				requesterInformation: {
					receivedParams: {
						apiVersion: 3,
					},
				},
			});
		});

		test("will fail on a missing version", () => {
			return expect(runActionPromise(api, "versionedAction", { apiVersion: 16 })).rejects.toHaveProperty("code", "004");
		});

		test("will fail in a missing action", function () {
			return expect(runActionPromise(api, "undefinedAction", {})).rejects.toHaveProperty("code", "004");
		});

		test("can return complex error responses", function () {
			return expect(
				runActionPromise(api, "versionedAction", {
					apiVersion: 3,
				}),
			).rejects.toEqual({
				reason: {
					msg: "description",
				},
			});
		});
	});

	describe("Action Params", function () {
		beforeAll(() => {
			engine.api.actions.versions.testAction = [1];
			engine.api.actions.actions.testAction = {
				"1": {
					name: "testAction",
					description: "this action has some required params",
					version: 1,
					inputs: {
						requiredParam: { required: true },
						optionalParam: { required: false },
						fancyParam: {
							required: false,
							default: "test123",
							validator: function (s) {
								if (s === "test123") {
									return true;
								}
								return `fancyParam should be 'test123'. so says ${this.id}`;
							},
						},
					},

					run: (api, connection, next) => {
						connection.response.params = connection.params;
						next();
					},
				},
			};
		});

		afterAll(() => {
			delete engine.api.actions.versions.testAction;
			delete engine.api.actions.actions.testAction;
		});

		test("correct params that are false or [] should be allowed", async function (done) {
			const response1 = await runActionPromise(api, "testAction", {
				requiredParam: false,
			});
			expect(response1.params.requiredParam).toBe(false);

			const response2 = await runActionPromise(api, "testAction", {
				requiredParam: [],
			});
			expect(response2.params.requiredParam).toEqual([]);
		});

		test("will fail for missing or empty params", async function () {
			await expect(
				runActionPromise(api, "testAction", {
					requiredParam: "",
				}),
			).resolves.not.toHaveProperty("error");

			await expect(runActionPromise(api, "testAction", {})).rejects.toHaveProperty(
				"requiredParam",
				"The requiredParam field is required.",
			);
		});

		test("correct params respect config options", async function () {
			engine.api.config.general.missingParamChecks = [undefined];

			const response = await runActionPromise(api, "testAction", {
				requiredParam: "",
			});
			expect(response.params).toHaveProperty("requiredParam", "");

			const response2 = await runActionPromise(api, "testAction", {
				requiredParam: null,
			});
			expect(response2.params.requiredParam).toBeNull();
		});

		test("will set a default when params are not provided", async function () {
			const response = await runActionPromise(api, "testAction", {
				requiredParam: true,
			});

			expect(response.params).toHaveProperty("fancyParam", "test123");
		});

		test("will use validator if provided", () => {
			return expect(
				runActionPromise(api, "testAction", {
					requiredParam: true,
					fancyParam: 123,
				}),
			).rejects.toHaveProperty("fancyParam", `fancyParam should be 'test123'. so says test-server`);
		});

		test("validator will have the API object in scope and this", async () => {
			return expect(
				runActionPromise(api, "testAction", {
					requiredParam: true,
					fancyParam: 123,
				}),
			).rejects.toEqual({
				fancyParam: "fancyParam should be 'test123'. so says test-server",
			});
		});
	});
});
