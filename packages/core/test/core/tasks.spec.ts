import { startEngine } from "../utils";
import Engine from "../../lib/engine";

let engine: Engine;
let api: any = null;

describe("Core: Tasks", () => {
  beforeAll(async () => {
    engine = await startEngine();
    api = engine.api;
  });

  afterAll(async () => engine.stop());

  test("can run the task manually", async () => {
    const response = await api.helpers.runTask("runAction", {
      action: "randomNumber",
    });

    expect(response.number).toBeGreaterThan(0);
    expect(response.number).toBeLessThan(1);
  });
});
