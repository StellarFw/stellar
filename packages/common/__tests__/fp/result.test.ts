import { ok, err } from "../..";

describe("Result", () => {
  describe("isOk", () => {
    test("with an Ok returns true", () => {
      const x = ok<number, string>(-1);
      expect(x.isOk()).toBeTruthy();
    });

    test("with an Err returns false", () => {
      const x = err<number, string>("this is an error");
      expect(x.isOk()).toBeFalsy();
    });
  });

  describe("isErr", () => {
    test("with an Ok returns false", () => {
      const x = ok<number, string>(-1);
      expect(x.isErr()).toBeFalsy();
    });

    test("with an Err returns true", () => {
      const x = err<number, string>("this is an error");
      expect(x.isErr()).toBeTruthy();
    });
  });

  describe("contains", () => {
    test("with Ok given the same value returns true", () => {
      const x = ok(2);
      expect(x.contains(2)).toBeTruthy();
    });

    test("with Ok given a different value returns false", () => {
      const x = ok(3);
      expect(x.contains(2)).toBeFalsy();
    });

    test("with Err returns false", () => {
      const x = err<number, string>("Some error message");
      expect(x.contains(2)).toBeFalsy();
    });
  });

  describe("containsErr", () => {
    test("with Ok return false", () => {
      const x = ok<number, string>(2);
      expect(x.containsErr("Some error message")).toBeFalsy();
    });

    test("with Err given the same message returns true", () => {
      const x = err("Some error message");
      expect(x.containsErr("Some error message")).toBeTruthy();
    });

    test("with Err given an different message returns false", () => {
      const x = err("Some error message");
      expect(x.containsErr("Some other error message")).toBeFalsy();
    });
  });

  describe("ok", () => {
    test("with Ok return a Some with the Ok value", () => {
      const x = ok(2);
      expect(x.ok().unwrap()).toBe(2);
    });

    test("with Err return a None", () => {
      const x = err("nothing here");
      expect(x.ok().isNone()).toBeTruthy();
    });
  });

  describe("err", () => {
    test("with Ok return a None", () => {
      const x = ok(2);
      expect(x.err().isNone()).toBeTruthy();
    });

    test("with Err return a Some with the error value", () => {
      const x = err("nothing here");
      expect(x.err().unwrap()).toBe("nothing here");
    });
  });

  describe("map", () => {
    test("with Ok allows to change the value", () => {
      const x = ok(2);

      expect(x.map((v: number) => v * 2).contains(4)).toBeTruthy();
    });

    test("with Err does not change the error value", () => {
      const x = err<number, number>(2);

      expect(x.map((v: number) => v + 2).containsErr(2)).toBeTruthy();
    });
  });

  describe("mapOr", () => {
    test("with Ok execute the given functions", () => {
      const x = ok("foo");
      expect(x.mapOr(42, (v) => v.length)).toBe(3);
    });

    test("with Err return the default", () => {
      const x = err<string, string>("bar");
      expect(x.mapOr(42, (v) => v.length)).toBe(42);
    });
  });

  describe("mapOrElse", () => {
    const k = 21;

    test("with Ok execute second functions", () => {
      const x = ok<string, string>("foo");
      expect(
        x.mapOrElse(
          () => k * 2,
          (v) => v.length,
        ),
      ).toBe(3);
    });

    test("with Err execute first functions", () => {
      const x = err<string, string>("foo");
      expect(
        x.mapOrElse(
          () => k * 2,
          (v) => v.length,
        ),
      ).toBe(42);
    });
  });

  describe("mapErr", () => {
    const stringify = (x: number) => `error code: ${x}`;

    test("with Ok do nothing", () => {
      const x = ok<number, number>(2);
      expect(x.mapErr(stringify).contains(2)).toBeTruthy();
    });

    test("with Err execute function", () => {
      const x = err<number, number>(13);
      expect(x.mapErr(stringify).containsErr("error code: 13")).toBeTruthy();
    });
  });

  describe("and", () => {
    test("with Ok given Err returns Err", () => {
      const x = ok(2);
      const y = err("late error");
      expect(x.and(y).containsErr("late error")).toBeTruthy();
    });

    test("with Err given Ok return Err", () => {
      const x = err<string, string>("early error");
      const y = ok<string, string>("foo");

      expect(x.and(y).containsErr("early error")).toBeTruthy();
    });

    test("with Err given Err return first Err", () => {
      const x = err("not a 2");
      const y = ok<string, string>("late error");

      expect(x.and(y).containsErr("not a 2")).toBeTruthy();
    });

    test("with Ok given Ok return second Ok", () => {
      const x = ok(2);
      const y = ok("other value");

      expect(x.and(y).contains("other value")).toBeTruthy();
    });
  });

  test("andThen", () => {
    const sq = (x: number) => ok<number, number>(x * x);
    const error = (x: number) => err<number, number>(x);

    expect(ok(2).andThen(sq).andThen(sq).contains(16)).toBeTruthy();
    expect(ok(2).andThen(sq).andThen(error).containsErr(4)).toBeTruthy();
    expect(ok(2).andThen(error).andThen(sq).containsErr(2)).toBeTruthy();
    expect(err<number, number>(3).andThen(sq).andThen(sq).containsErr(3)).toBeTruthy();
  });

  describe("or", () => {
    test("with Ok given Err returns Ok", () => {
      const x = ok<number, string>(2);
      const y = err<number, string>("late error");
      expect(x.or(y).contains(2)).toBeTruthy();
    });

    test("with Err given Ok return Ok", () => {
      const x = err<string, string>("early error");
      const y = ok<string, string>("foo");

      expect(x.or(y).contains("foo")).toBeTruthy();
    });

    test("with Err given Err return second Err", () => {
      const x = err("not a 2");
      const y = err<string, string>("late error");

      expect(x.or(y).containsErr("late error")).toBeTruthy();
    });

    test("with Ok given Ok return first Ok", () => {
      const x = ok<number, string>(2);
      const y = ok<number, string>(100);

      expect(x.or(y).contains(2)).toBeTruthy();
    });
  });

  test("orElse", () => {
    const sq = (x: number) => ok<number, number>(x * x);
    const error = (x: number) => err<number, number>(x);

    expect(ok<number, number>(2).orElse(sq).orElse(sq).contains(2)).toBeTruthy();
    expect(ok<number, number>(2).orElse(error).orElse(sq).contains(2)).toBeTruthy();
    expect(err<number, number>(3).orElse(sq).orElse(error).contains(9)).toBeTruthy();
    expect(err<number, number>(3).orElse(error).orElse(error).containsErr(3)).toBeTruthy();
  });

  describe("unwrapOr", () => {
    test("with Ok returns the value", () => {
      const x = ok(9);
      expect(x.unwrapOr(2)).toBe(9);
    });

    test("with Err returns the given value", () => {
      const x = err(9);
      expect(x.unwrapOr(2)).toBe(2);
    });
  });

  describe("unwrapElse", () => {
    const count = (x: string) => x.length;

    test("with Ok returns the value", () => {
      const x = ok<number, string>(2);
      expect(x.unwrapOrElse(count)).toBe(2);
    });

    test("with Err returns the given value", () => {
      const x = err<number, string>("foo");
      expect(x.unwrapOrElse(count)).toBe(3);
    });
  });

  describe("expect", () => {
    test("with Ok returns the contained value", () => {
      const x = ok(40);
      expect(x.expect("should have an value")).toBe(40);
    });

    test("with Err panics with the message", () => {
      const x = err("emergency failure");

      try {
        x.expect("Testing expect");
        fail("this should fail");
      } catch (e) {
        expect(e.message).toBe("panics with `Testing expect: emergency failure`");
      }
    });
  });

  describe("unwrap", () => {
    test("with Ok returns the contained value", () => {
      const x = ok(2);
      expect(x.unwrap()).toBe(2);
    });

    test("with Err panics with the contained error", () => {
      const x = err("emergency failure");

      try {
        x.unwrap();
        fail("this must fail");
      } catch (e) {
        expect(e.message).toBe("panics with `emergency failure`");
      }
    });
  });

  describe("expectErr", () => {
    test("with Ok panics with the given message", () => {
      const x = ok(10);

      try {
        x.expectErr("Testing expect_err");
        fail("this must fail");
      } catch (e) {
        expect(e.message).toBe("panics with `Testing expect_err: 10`");
      }
    });

    test("with Err returns the contained error", () => {
      const x = err("emergency failure");
      expect(x.expectErr("Testing expect_err")).toBe("emergency failure");
    });
  });

  describe("unwrapErr", () => {
    test("with Ok panics with the contained error", () => {
      const x = ok(2);

      try {
        x.unwrapErr();
        fail("this must fail");
      } catch (e) {
        expect(e.message).toBe("panics with `2`");
      }
    });
  });

  test("with Err returns the contained value", () => {
    const x = err("emergency failure");
    expect(x.unwrapErr()).toBe("emergency failure");
  });

  describe("tap", () => {
    test("tap Ok executes some side-effect function", () => {
      let controlBool = false;

      const value = ok(1);
      value.tap({
        ok(val) {
          controlBool = true;

          expect(val).toBe(1);
        },
        err() {
          fail("must execute the ok function");
        },
      });

      expect(controlBool).toBeTruthy();
    });

    test("tap Err executes some side-effect function", () => {
      let controlBool = false;

      const value = err(1);
      value.tap({
        ok() {
          fail("must execute the err function");
        },
        err(e) {
          controlBool = true;

          expect(e).toBe(1);
        },
      });

      expect(controlBool).toBeTruthy();
    });

    test("tapErr on Ok doesn't execute", () => {
      ok(1).tapErr(() => fail("Can't be executed when is a Ok value"));
    });

    test("tapErr on Err execute", () => {
      let controlBool = false;
      err(1).tapErr(() => {
        controlBool = true;
      });

      expect(controlBool).toBeTruthy();
    });

    test("tapOk on Ok execute", () => {
      let controlBool = false;

      ok(1).tapOk(() => {
        controlBool = true;
      });
      expect(controlBool).toBeTruthy();
    });

    test("tapOk on Err must not execute", () => {
      err(1).tapOk(() => fail("must not execute"));
    });
  });
});
