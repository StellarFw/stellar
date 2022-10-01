/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, test } from "vitest";
import { Action, asyncAlways, ok, pipeInto } from "..";
import { behavior, createAction, input } from "./action-builder";

describe("Common", () => {
  describe("Action Builder", () => {
    describe("createAction", () => {
      test("returns a base action skeleton", async () => {
        const action = createAction("example");

        expect(action.name).toBe("example");
        expect(action.description).toBeUndefined();
        expect(action.version).toBe(1);
        expect((await action.run({}, {} as any)).isErr()).toBeTruthy();
      });

      test("when the second argument is given define the action description", () => {
        const action = createAction("example", "this is the action description");

        expect(action.name).toBe("example");
        expect(action.description).toBe("this is the action description");
      });
    });

    test("input generate an unary function to set an input on the given action", () => {
      const action: Action<unknown, { a: string }> = pipeInto(createAction("example"), input("a", { required: true }));

      expect(action.inputs.a).toBeDefined();
      expect(action.inputs.a.required).toBeTruthy();
    });

    test("behavior generate an unary function to set the action behavior", async () => {
      const action: Action<number, unknown> = pipeInto(createAction("test"), behavior(asyncAlways(ok(1))));

      expect((await action.run({}, {} as any)).contains(1)).toBeTruthy();
    });

    test("test whole action build syntax", async () => {
      interface ActionInputs {
        a: number;
        b: number;
      }

      const action: Action<number, ActionInputs> = pipeInto(
        createAction("sum", "sum two numbers"),
        input("a", { required: true }),
        input("b", { required: true }),
        behavior(async (params: ActionInputs) => ok(params.a + params.b)),
      );

      expect((await action.run({ a: 100, b: 100 }, {} as any)).contains(200)).toBeTruthy();
    });
  });
});
