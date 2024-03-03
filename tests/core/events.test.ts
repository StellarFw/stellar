import { describe, beforeAll, afterAll, it, afterEach } from "vitest";

import Engine from "../../lib/engine";
import { expect } from "vitest";
import { API } from "../../src/interfaces/api.interface";

const engine = new Engine({ rootPath: `${process.cwd()}/example` });

let api: API;

describe("Core: Event", () => {
	beforeAll(async () => {
		api = await engine.start();
	});

	afterAll(() => engine.stop());

	afterEach(async () => {
		await api.events.events.delete("prog");
	});

	it("event methods should exist", () => {
		expect(api.events).toBeTypeOf("object");
		expect(api.events.fire).toBeTypeOf("function");
		expect(api.events.listener).toBeTypeOf("function");
	});

	it("can read events from the listeners folder", () => {
		expect(api.events.events.has("example")).toBeTruthy();
	});

	it("event.listener", () => {
		api.events.listener("prog", (api, params) => {});
		expect(api.events.events.has("prog")).toBeTruthy();
	});

	it("event.fire", async () => {
		await expect(api.events.fire("example", { value: "" })).resolves.toMatchObject({
			value: "thisIsATest",
		});
	});

	it("listeners need an event name and a run function", () => {
		expect(api.events._listenerObj({})).toBeFalsy();
		expect(api.events._listenerObj({ event: "example" })).toBeFalsy();
		expect(
			api.events._listenerObj({
				event: "example",
				run: (api, params) => {},
			}),
		).toBeTruthy();
	});

	it("listeners can have a priority value", () => {
		api.events.listener(
			"prog",
			async (api, params) => {
				return {};
			},
			200,
		);
		expect(api.events.events.get("prog")[0].priority).toBe(200);
	});

	it("listeners have a default priority", () => {
		api.events.listener("prog", async (api, params) => {
			return {};
		});

		expect(api.events.events.get("prog")[0].priority).toBe(api.config.general.defaultListenerPriority);
	});

	it("listeners are executed in order", async () => {
		api.events.listener(
			"prog",
			(api, params, next) => {
				return { value: `${params.value}1` };
			},
			10,
		);

		api.events.listener(
			"prog",
			(api, params) => {
				return { value: `${params.value}0` };
			},
			5,
		);

		await expect(api.events.fire("prog", { value: "test" })).resolves.toMatchObject({ value: "test01" });
	});

	it("reads multiple events in the same listener", () => {
		expect(api.events.events.has("multiple")).toBeTruthy();
		expect(api.events.events.has("multiple_two")).toBeTruthy();
	});

	it("can execute a multiply event", async () => {
		await expect(api.events.fire("multiple", { value: "raw" })).resolves.toMatchObject({
			value: "raw_mod",
		});
	});

	describe("with a listener that changes the passed data to 100", () => {
		beforeAll(() => {
			api.events.listener(
				"testListener",
				(api, params) => {
					// modifying the parameters isn't expected, but we shouldn't believe on the developers good sense, so we need
					// to check if we protect the original data from being modified
					try {
						params.value = "other-value";
						return { value: 1000000 };
					} catch {
						return { value: 100 };
					}
				},
				5,
			);
		});

		afterAll(() => {
			api.events.cleanListenersForEvent("testListener");
		});

		it("passing data to the fire event doesn't change the original data", async () => {
			const originalData = { value: "sample-data" };
			await expect(api.events.fire("testListener", originalData)).resolves.toMatchObject({ value: 100 });
			expect(originalData.value).toBe("sample-data");
		});
	});
});
