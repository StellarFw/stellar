import { EngineStatus } from "@stellarfw/common";
import { describe, expect, test } from "vitest";
import { buildEngine } from "../utils";

describe("Core", () => {
	const engine = buildEngine();

	describe("Engine", () => {
		test("a new engine can be created", () => {
			expect(engine.api.status).toBe(EngineStatus.Stopped);
		});

		test("a new engine can be initialized", async () => {
			await engine.initialize();

			expect(engine.api.status).toBe(EngineStatus.Stage0);
		});

		test("a new engine can be started", async () => {
			await engine.start();

			expect(engine.api.status).toBe(EngineStatus.Running);
		});

		test("a new engine can be stopped", async () => {
			await engine.stop();

			expect(engine.api.status).toBe(EngineStatus.Stopped);
		});
	});
});
