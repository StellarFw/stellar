import { startEngine } from "../utils";
import Engine from "../../dist/engine";

let engine: Engine = null;
let api: any = null;

describe("Core: Actions", () => {
  beforeAll(async () => {
    engine = await startEngine();
    api = engine.api;
  });

  afterAll(async () => engine.stop());

  describe("can execute internally", () => {
    test("without params", () => {
      expect(api.actions.call("formattedSum")).rejects.toBeDefined();
    });

    test("normally", () => {
      expect(api.actions.call("formattedSum", { a: 3, b: 3 })).resolves.toEqual(
        { formatted: "3 + 3 = 6" },
      );
    });
  });

  describe("Groups", () => {
    test("can read the group from an action", () => {
      expect(api.actions.groupsActions.has("example")).toBeTruthy();
    });

    test("the action name exists on the group", () => {
      const arrayOfAction = api.actions.groupsActions.get("example");
      expect(arrayOfAction).toContain("groupTest");
    });

    test("supports the group property", async () => {
      const response = await api.actions.call("groupTest");
      expect(response.result).toBe("OK");
    });

    test("support modules", async () => {
      const response = await api.actions.call("modModuleTest");
      expect(response.result).toBe("OK");
    });

    test("support the actions property", async () => {
      const response = await api.actions.call("modTest");
      expect(response.result).toBe("OK");
    });

    test("can add new items to an array", async () => {
      const response = await api.actions.call("groupAddItems");
      expect(response.result).toEqual(["a", "b", "c"]);
    });

    test("can remove items from the array", async () => {
      const response = await api.actions.call("groupRmItems");
      expect(Array.isArray(response.result)).toBeTruthy();
      expect(response.result.includes("a")).toBeTruthy();
      expect(response.result.includes("b")).toBeFalsy();
    });
  });

  describe("Timeout", () => {
    beforeAll(() => {
      api.configs.general.actionTimeout = 100;
    });

    afterAll(() => {
      api.configs.general.actionTimeout = 30000;
    });

    test("when the action exceed the config time in timeout", async () => {
      try {
        await api.actions.call("sleep", {
          sleepDuration: 150,
        });
      } catch (_) {
        return;
      }

      throw new Error("The action execution should timeout");
    });

    test("throw a well formed error", async () => {
      try {
        await api.actions.call("sleep", { sleepDuration: 150 });
      } catch (error) {
        expect(error.code).toBe("022");
        expect(error.message).toBe(`Response timeout for action 'sleep'`);
      }
    });
  });

  test("can use a function to set a param default value", async () => {
    const response = await api.actions.call("input-default-function");
    expect(response.value).toBe(156);
  });
});
