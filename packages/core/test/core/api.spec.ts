import { startEngine } from "../utils";
import Engine from "../../lib/engine";

let engine: Engine;
let api: any = null;

describe("Actions", () => {
  beforeAll(async () => {
    engine = await startEngine();
    api = engine.api;
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
          async run() {
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

    test("will default clients to the latest version of the action", async () => {
      const response = await api.helpers.runAction("versionedAction");
      expect(response.requesterInformation.receivedParams.apiVersion).toBe(3);
    });

    test("will fail on a missing version", async () => {
      const response = await api.helpers.runAction("versionedAction", {
        apiVersion: 16,
      });
      expect(response.error.code).toBe("004");
    });

    test("can return complex error responses", async () => {
      const response = await api.helpers.runAction("versionedAction", {
        apiVersion: 3,
      });
      expect(response.error.reason.msg).toBe("description");
    });
  });

  describe("Action Params", () => {
    beforeAll(() => {
      api.actions.versions.testAction = [1];
      api.actions.actions.testAction = {
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
              validator(s) {
                if (s === "test123") {
                  return true;
                }
                return `fancyParam should be 'test123'. so says ${this.id}`;
              },
            },
          },

          run(_, connection) {
            connection.response.params = connection.params;
          },
        },
      };
    });

    afterAll(() => {
      delete api.actions.versions.testAction;
      delete api.actions.actions.testAction;
    });

    test("correct params that are false or [] should be allowed", async () => {
      let response = await api.helpers.runAction("testAction", {
        requiredParam: false,
      });
      expect(response.params.requiredParam).toBeFalsy();

      response = await api.helpers.runAction("testAction", {
        requiredParam: [],
      });
      expect(response.params.requiredParam).toEqual([]);
    });

    test("Will fail for missing or empty params", async () => {
      let response = await api.helpers.runAction("testAction", {
        requiredParam: "",
      });
      expect(response.error).toBeUndefined();

      response = await api.helpers.runAction("testAction", {});
      expect(response.error.requiredParam).toBe("The requiredParam field is required.");
    });

    test("correct params respect config options", async () => {
      api.configs.general.missingParamChecks = [undefined];

      let response = await api.helpers.runAction("testAction", {
        requiredParam: "",
      });
      expect(response.params.requiredParam).toBe("");

      response = await api.helpers.runAction("testAction", {
        requiredParam: null,
      });
      expect(response.params.requiredParam).toBeNull();
    });

    test("will set a default when params are not provided", async () => {
      const response = await api.helpers.runAction("testAction", {
        requiredParam: true,
      });
      expect(response.params.fancyParam).toBe("test123");
    });

    test("will use validator if provided", async () => {
      const response = await api.helpers.runAction("testAction", {
        requiredParam: true,
        fancyParam: 123,
      });
      expect(response.error.fancyParam).toBe("fancyParam should be 'test123'. so says test-server");
    });
  });
});
