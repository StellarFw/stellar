import { panic, unsafe, unsafeAsync } from ".";

describe("executor", () => {
  test("panic throws an exception", () => {
    try {
      panic("this is an exception");
    } catch (e) {
      expect(e.message).toBe("this is an exception");
    }
  });

  describe("unsafe", () => {
    test("the function does not throw an exception returns the result", () => {
      const testDivision = () => 10 / 2;
      expect(unsafe(testDivision).contains(5)).toBeTruthy();
    });

    test("the function throws an exception and returns an error inside a result", () => {
      const testFn = () => {
        throw new Error("this is an error");
      };
      expect(unsafe(testFn).containsErr("this is an error")).toBeTruthy();
    });
  });

  describe("unsafeAsync", () => {
    test("the function does not throw an exception returns the result", async () => {
      const testDivision = async () => (await 10) / 2;
      expect((await unsafeAsync(testDivision)).contains(5)).toBeTruthy();
    });

    test("the function throws an exception and returns an error inside a result", async () => {
      const testFn = () => {
        throw new Error("this is an error");
      };
      expect((await unsafeAsync(testFn)).containsErr("this is an error")).toBeTruthy();
    });
  });
});
