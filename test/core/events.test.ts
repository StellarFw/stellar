import { identity } from "@stellarfw/common/lib/index.js";
import { buildEngine } from "../test-utils";

describe("Core", () => {
  const engine = buildEngine();

  beforeAll(() => engine.start());
  afterAll(() => engine.stop());

  describe("Events", () => {
    afterEach(() => engine.api.events.events.delete("prog"));

    test("can read events from the listeners folder", () => {
      expect(engine.api.events.events.has("example")).toBeTruthy();
    });

    test("remove all listeners for an event", () => {
      engine.api.events.listener("prog", identity);
      engine.api.events.removeAll("prog");

      expect(engine.api.events.events.has("prog")).toBeFalsy();
    });

    test("supports adding a new listener", () => {
      engine.api.events.listener("prog", identity);
      expect(engine.api.events.events.has("prog")).toBeTruthy();
    });

    test("can fire an event", async () => {
      const response = await engine.api.events.fire("example", { value: "" });
      expect(response.value).toBe("thisIsATest");
    });

    test("listeners need an event name and a run function", () => {
      expect(engine.api.events.listenerObj({}).isErr()).toBeTruthy();
      expect(
        engine.api.events
          .listenerObj({
            event: "example",
          })
          .isErr(),
      ).toBeTruthy();
      expect(
        engine.api.events
          .listenerObj({
            event: "example",
            run: identity,
          })
          .isOk(),
      ).toBeTruthy();
    });

    test("listeners can have a priority value", () => {
      engine.api.events.listener("prog", identity, 200);
      const priority = engine.api.events.events.get("prog")[0].priority;
      expect(priority).toBe(200);
    });

    test("listeners have a default priority", () => {
      engine.api.events.listener("prog", identity);
      const priority = engine.api.events.events.get("prog")[0].priority;
      expect(priority).toBe(engine.api.configs.general.defaultListenerPriority);
    });

    test("listeners are executed in order", async () => {
      engine.api.events.listener(
        "prog",
        (params) => ({
          value: params.value + "1",
        }),
        10,
      );

      engine.api.events.listener(
        "prog",
        (params) => ({
          value: params.value + "0",
        }),
        5,
      );

      const response = await engine.api.events.fire("prog", { value: "test" });
      expect(response.value).toBe("test01");
    });

    test("reads multiple events in the same listener", () => {
      expect(engine.api.events.events.has("multiple")).toBeTruthy();
      expect(engine.api.events.events.has("multiple_two")).toBeTruthy();
    });

    test("can execute a multiply event", async () => {
      const response = await engine.api.events.fire("multiple", { value: "raw" });
      expect(response.value).toBe("raw_mod");
    });
  });
});
