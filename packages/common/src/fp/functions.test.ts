import { always } from ".";

describe("functions", () => {
  test("always returns a function that always returns the original value", () => {
    expect(always(123)()).toBe(123);
  });
});
