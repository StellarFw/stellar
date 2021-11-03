import { io } from "../..";

describe("IO", () => {
  test("map identity", () => {
    const container = io(() => 42);

    expect(
      container
        .map((x) => x)
        .run()
        .unwrap(),
    ).toBe(container.run().unwrap());
  });

  test("map composition", () => {
    const container = io(() => 42);
    const f = (x) => x + 2;
    const g = (x) => x * 2;

    expect(container.map(f).map(g).run().unwrap()).toBe(
      container
        .map((x) => g(f(x)))
        .run()
        .unwrap(),
    );
  });
});
