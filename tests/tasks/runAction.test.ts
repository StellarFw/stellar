import { describe, beforeAll, afterAll, it } from "vitest";

import Engine from "../../src/engine";
import { expect } from "vitest";

const engine = new Engine({ rootPath: process.cwd() + "/example" });

let api = null;

describe("Test: RunAction", () => {
  beforeAll(
    () =>
      new Promise((done) => {
        engine.start((error, a) => {
          api = a;
          done();
        });
      })
  );

  afterAll(
    () =>
      new Promise((done) => {
        engine.stop(done);
      })
  );

  it("can run the task manually", async () => {
    const response = await new Promise((resolve, reject) => {
      api.helpers.runTask(
        "runAction",
        { action: "randomNumber" },
        (error, response) => (!!error ? reject(error) : resolve(response))
      );
    });

    expect(response.number).toBeGreaterThan(0);
    expect(response.number).toBeLessThan(1);
  });
});
