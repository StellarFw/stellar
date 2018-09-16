import { startEngine } from "../utils";
import Engine from "../../lib/engine";

let engine: Engine = null;
let api: any = null;

describe("Core: Errors", () => {
  beforeAll(async () => {
    engine = await startEngine();
    api = engine.api;
  });

  afterAll(async () => engine.stop());

  test("returns string errors properly", async () => {
    const response = await api.helpers.runAction("aNotExistingAction");
    expect(response.error.code).toBe("004");
  });

  test("returns Error object properly", async () => {
    api.configs.errors.unknownAction = () => new Error("error test");

    const response = await api.helpers.runAction("aNotExistingAction");
    expect(response.error).toBe("Error: error test");
  });

  test("returns generic object properly", async () => {
    api.configs.errors.unknownAction = () => ({ code: "error160501" });

    const response = await api.helpers.runAction("aNotExistingAction");
    expect(response.error.code).toBe("error160501");
  });
});
