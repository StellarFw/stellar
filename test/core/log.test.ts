import { LogLevel } from "@stellarfw/common/lib";
import { buildEngine } from "../test-utils";

describe("Core", () => {
  const engine = buildEngine();

  beforeAll(() => engine.start());
  afterAll(() => engine.stop());

  describe("Log", () => {
    test("the log method should work", () => {
      engine.api.log("hello, world", LogLevel.Info);
    });

    test("the winston loggers are available via the loggers satellite", () => {
      expect(engine.api.logger.transports.length).toBe(1);
    });
  });
});
