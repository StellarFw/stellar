import { startEngine } from "../utils";
import Engine from "../../dist/engine";

let engine: Engine = null;
let api: any = null;

describe("Actions", () => {
  beforeAll(async () => {
    const result = await startEngine();
    engine = result.engine;
    api = result.api;
  });

  afterAll(async () => engine.stop());

  test("Should have an api object with proper parts", () => {
    expect(typeof api.actions.actions).toBe("object");
    expect(typeof api.actions.versions).toBe("object");
    expect(typeof api.config).toBe("object");
  });

  describe("API versions", () => {
    beforeAll(() => {
      api.actions.versions.versionedAction = [1, 2, 3];
      api.actions.actions.versionedAction = {
        "1": {
          name: "versionedAction",
          description: "A test action",
          version: 1,
          async run(_, action) {
            action.response.version = 1;
          },
        },
        "2": {
          name: "versionedAction",
          description: "A test action",
          version: 2,
          async run(_, action) {
            action.response.version = 2;
          },
        },
        "3": {
          name: "versionedAction",
          description: "A test action",
          version: 3,
          async run(_, action) {
            const complexError = {
              reason: { msg: "description" },
            };
            throw complexError;
          },
        },
      };
    });

    afterAll(() => {
      delete api.actions.actions.versionedAction;
      delete api.actions.versions.versionedAction;
    });

    test("will default actions to version 1 when no version is provided by the definition", async () => {
      const response = await api.helpers.runAction("randomNumber");
      expect(response.requesterInformation.receivedParams.apiVersion).toBe(1);
    });

    test("Can specify an apiVersion", async () => {
      let response = await api.helpers.runAction("versionedAction", {
        apiVersion: 1,
      });

      expect(response.requesterInformation.receivedParams.apiVersion).toBe(1);

      response = await api.helpers.runAction("versionedAction", {
        apiVersion: 2,
      });

      expect(response.requesterInformation.receivedParams.apiVersion).toBe(2);
    });
  });
});
