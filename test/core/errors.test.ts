import { buildEngine } from "../test-utils";

describe("Core", () => {
  const engine = buildEngine();

  beforeAll(() => engine.start());
  afterAll(() => engine.stop());

  describe("Errors", () => {
    test("returns string errors properly", async () => {
      const response = await engine.api.helpers.runAction("aNotExistingAction");
      expect(response.error.code).toBe("004");
    });

    test("returns Error object properly", async () => {
      engine.api.configs.errors.unknownAction = () => new Error("error test");

      const response = await engine.api.helpers.runAction("aNotExistingAction");
      expect(response.error).toBe("Error: error test");
    });

    test("returns generic object properly", async () => {
      engine.api.configs.errors.unknownAction = () => ({ code: "error160501" });

      const response = await engine.api.helpers.runAction("aNotExistingAction");
      expect(response.error.code).toBe("error160501");
    });
  });
});
