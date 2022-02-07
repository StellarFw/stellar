import { startEngine } from "../utils";
import Engine from "../../lib/engine";

let engine: Engine;
let api: any = null;

describe("Core: Events", () => {
  beforeAll(async () => {
    engine = await startEngine();
    api = engine.api;
  });

  afterAll(async () => engine.stop());

  afterEach(() => api.events.events.delete("prog"));

  test("can read events from the listeners folder", () => {
    expect(api.events.events.has("example")).toBeTruthy();
  });

  test("supports adding a new listener", () => {
    api.events.listener("prog", () => {});
    expect(api.events.events.has("prog")).toBeTruthy();
  });

  test("can fire an event", async () => {
    const response = await api.events.fire("example", { value: "" });
    expect(response.value).toBe("thisIsATest");
  });

  test("listeners need an event name and a run function", () => {
    expect(api.events.listenerObj({})).toBeFalsy();
    expect(
      api.events.listenerObj({
        event: "example",
      }),
    ).toBeFalsy();
    expect(
      api.events.listenerObj({
        event: "example",
        run() {},
      }),
    ).toBeTruthy();
  });

  test("listeners can have a priority value", () => {
    api.events.listener("prog", () => {}, 200);
    const priority = api.events.events.get("prog")[0].priority;
    expect(priority).toBe(200);
  });

  test("listeners have a default priority", () => {
    api.events.listener("prog", () => {});
    const priority = api.events.events.get("prog")[0].priority;
    expect(priority).toBe(api.configs.general.defaultListenerPriority);
  });

  test("listeners are executed in order", async () => {
    api.events.listener(
      "prog",
      (params) => {
        params.value += "1";
      },
      10,
    );

    api.events.listener(
      "prog",
      (params) => {
        params.value += "0";
      },
      5,
    );

    const response = await api.events.fire("prog", { value: "test" });
    expect(response.value).toBe("test01");
  });

  test("reads multiple events in the same listener", () => {
    expect(api.events.events.has("multiple")).toBeTruthy();
    expect(api.events.events.has("multiple_two")).toBeTruthy();
  });

  test("can execute a multiply event", async () => {
    const response = await api.events.fire("multiple", { value: "raw" });
    expect(response.value).toBe("raw_mod");
  });
});
