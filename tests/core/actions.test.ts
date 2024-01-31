import { describe, beforeAll, afterAll, it } from "vitest";

import Engine from "../../src/engine";
import { expect } from "vitest";

const engine = new Engine({ rootPath: process.cwd() + "/example" });

let api = null;

describe("Core: Actions", () => {
  beforeAll(
    () =>
      new Promise((done) => {
        // start a Stellar instance
        engine.start((error, a) => {
          api = a;
          done();
        });
      })
  );

  afterAll(
    () =>
      new Promise((done) => {
        // finish the Stellar instance execution
        engine.stop(done);
      })
  );

  // ----------------------------------------------------------- [Internal Call]

  describe("can execute internally", () => {
    it("without params", () => {
      expect(api.actions.call("formattedSum")).rejects.toEqual({
        a: "The a field is required.",
        b: "The b field is required.",
      });
    });

    it("reject works", () => {
      expect(api.actions.call("formattedSum")).rejects.toThrow();
    });

    it("normally", () => {
      expect(api.actions.call("formattedSum", { a: 3, b: 3 })).resolves.toEqual(
        { formatted: "3 + 3 = 6" }
      );
    });
  });

  // ------------------------------------------------------------------ [Groups]

  describe("Groups", () => {
    it("can read the group from an action", () => {
      expect(api.actions.groupsActions.has("example")).toBeTruthy();
    });

    it("the action name exists on the group", (done) => {
      const arrayOfAction = api.actions.groupsActions.get("example");
      expect(arrayOfAction).toContain("groupTest");
    });

    it("support the group property", (done) => {
      expect(api.actions.call("groupTest")).resolves.toEqual({ result: "OK" });
    });

    it("support modules", (done) => {
      expect(api.actions.call("modModuleTest")).resolves.toEqual({
        result: "OK",
      });
    });

    it("support the actions property", (done) => {
      expect(api.actions.call("modTest")).resolves.toEqual({ result: "OK" });
    });

    it("can add new items to an array", () => {
      expect(api.actions.call("groupAddItems")).resolves.toHaveProperty(
        "result",
        ["a", "b", "c"]
      );
    });

    it("can remove items from the array", async () => {
      const response = await api.actions.call("groupRmItems");
      expect(response.result).toContain("a");
      expect(response.result).not.toContain("b");
    });
  });

  // ------------------------------------------------------------------- [Timeout]

  describe("Timeout", () => {
    // define the timeout to just 100 ms
    beforeAll(() => {
      api.config.general.actionTimeout = 100;
    });

    // reset the actionTimeout to the normal value
    afterAll(() => {
      api.config.general.actionTimeout = 30000;
    });

    it("when the action exceed the config time it timeout", () => {
      expect(api.actions.call("sleep", { sleepDuration: 150 })).rejects.toEqual(
        {
          code: "022",
          message: `Response timeout for action 'sleep'`,
        }
      );
    });
  });

  // ------------------------------------------------------------------- [Other]

  it("is possible finish an action retuning a promise", () => {
    expect(api.actions.call("promiseAction")).resolves.toHaveProperty(
      "success",
      `It's working!`
    );
  });

  it("is possible using a foreign promise to finish an action", (done) => {
    expect(api.actions.call("internalCallPromise")).resolves.toHaveProperty(
      "result",
      `4 + 5 = 9`
    );
  });

  it("can handle promise rejections and exceptions", (done) => {
    expect(api.actions.call("errorPromiseAction")).rejects.toHaveProperty(
      "message",
      "This is an error"
    );
  });

  it("can use a function to set a param default value", async () => {
    expect(api.actions.call("input-default-function")).resolves.toHaveProperty(
      "value",
      156
    );
  });

  it("can use a function to set a param default value accessing the api object", async () => {
    const testVal = "looks-awesome";
    api.config.testValue = testVal;

    expect(api.actions.call("inputDefaultFunctionApi")).resolves.toHaveProperty(
      "value",
      testVal
    );
  });
});
