import Engine from "../../dist/engine";
import { buildEngineArgs } from "../utils";

let engine: Engine = null;
let api: any = null;

describe("Actions", () => {
  beforeAll(async () => {
    engine = new Engine(buildEngineArgs());
    await engine.initialize();
    await engine.start();
    api = engine.api;
  });

  afterAll(async () => engine.stop());

  test("Test", () => {
    expect(2).toBe(2);
  });
});
