import { describe, beforeAll, afterAll, it } from "vitest";

import Engine from "../../src/engine";
import { expect } from "vitest";

const engine = new Engine({ rootPath: process.cwd() + "/example" });

let api = null;

describe("Core: Utils", () => {
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
        engine.stop(done);
      })
  );

  describe("for randomStr", () => {
    it("the function must exist and the result be a string", () => {
      expect(api.utils.randomStr).toBeDefined();
      expect(api.utils.randomStr()).toBeTypeOf("string");
    });

    it("when no length given must generate a 16 length string", () => {
      const result = api.utils.randomStr();
      expect(result.length).toBe(16);
    });

    it("when length is given the generated string must have that length", () => {
      const result = api.utils.randomStr(32);
      expect(result.length).toBe(32);
    });
  });
});
