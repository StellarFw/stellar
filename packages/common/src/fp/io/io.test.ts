import { describe, expect, test } from "vitest";
import { io } from ".";
import { ok, unsafe } from "..";

describe("IO", () => {
  test("map identity", () => {
    const container = io(() => 42);

    expect(container.map((x) => x).run()).toBe(container.run());
  });

  test("map composition", () => {
    const container = io(() => 42);
    const f = (x) => x + 2;
    const g = (x) => x * 2;

    expect(container.map(f).map(g).run()).toBe(container.map((x) => g(f(x))).run());
  });

  test("function that returns a Promise", async () => {
    const container = io(async () => 50);
    expect(await container.run()).toBe(50);
  });

  test("function that returns a Result", async () => {
    const container = io(() => ok(10));

    expect(container.run().unwrap()).toBe(10);
  });

  test("doing an unsafe operation", () => {
    const container = io(() =>
      unsafe(() => {
        throw new Error("something wrong");
      }),
    );

    expect(container.run().isErr()).toBeTruthy();
  });
});
