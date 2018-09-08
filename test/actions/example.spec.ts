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

  test("Test", () => {
    expect(2).toBe(2);
  });
});
