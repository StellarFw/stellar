import { panic } from "../..";

describe("executor", () => {
  test("panic throws an exception", () => {
    try {
      panic("this is an exception");
      fail("must fail");
    } catch (e) {
      expect(e.message).toBe("this is an exception");
    }
  });
});
