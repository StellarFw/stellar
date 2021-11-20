import { buildEngine } from "../test-utils";

describe("Core", () => {
  const engine = buildEngine();

  beforeAll(() => engine.start());
  afterAll(() => engine.stop());

  describe("Validator", () => {
    /**
     * Call a single validation.
     *
     * @param name
     * @param value
     * @returns
     */
    const singleValidation = (name, value) =>
      engine.api.validator.validate({ key: value }, { key: name }).mapErr((errors) => errors.key);

    test("alpha", () => {
      expect(singleValidation("alpha", "alpha").isOk()).toBeTruthy();

      expect(singleValidation("alpha", "alpha123").isErr()).toBeTruthy();
    });

    test("alpha_num", () => {
      expect(singleValidation("alpha_num", "alpha").isOk()).toBeTruthy();
      expect(singleValidation("alpha_num", "alpha123").isOk()).toBeTruthy();

      expect(singleValidation("alpha_num", "alpha %").isErr()).toBeTruthy();
    });

    test("alpha_dash", () => {
      expect(singleValidation("alpha_dash", "alpha").isOk()).toBeTruthy();
      expect(singleValidation("alpha_dash", "alpha123").isOk()).toBeTruthy();
      expect(singleValidation("alpha_dash", "al-ph_a").isOk()).toBeTruthy();

      expect(singleValidation("alpha_dash", "alpha12-3_ ").isErr()).toBeTruthy();
    });

    test("array", () => {
      expect(singleValidation("array", [1, 2, 3]).isOk()).toBeTruthy();

      expect(singleValidation("array", { a: 1, b: 2 }).isErr()).toBeTruthy();
      expect(singleValidation("array", "asd").isErr()).toBeTruthy();
    });

    test("before", () => {
      const res = singleValidation("before:2016--28", "");
      expect(res.isErr()).toBeTruthy();
      expect(res.unwrapErr()[0]).toBe("The specified argument is not a valid date");

      expect(singleValidation("before:2016-05-28", "asd").isErr()).toBeTruthy();
      expect(singleValidation("before:2016-05-28", "2016-05-12").isOk()).toBeTruthy();
      expect(singleValidation("before:2016-05-28", "2016-07-18").isErr()).toBeTruthy();
    });

    test("after", () => {
      const res = singleValidation("after:2016--28", "");
      expect(res.isErr()).toBeTruthy();
      expect(res.unwrapErr()[0]).toBe("The specified argument is not a valid date");

      expect(singleValidation("after:2016-11-26", "asd").isErr()).toBeTruthy();
      expect(singleValidation("after:2016-11-26", "2016-11-25").isErr()).toBeTruthy();
      expect(singleValidation("after:2016-11-26", "2016-11-26").isErr()).toBeTruthy();
      expect(singleValidation("after:2016-11-26", "2016-11-27").isOk()).toBeTruthy();
    });

    test("between", () => {
      expect(singleValidation("between", "").isErr()).toBeTruthy();
      expect(singleValidation("between:20,50", "asd").isErr()).toBeTruthy();
      expect(singleValidation("between:1,3", "23").isOk()).toBeTruthy();
      expect(singleValidation("between:5,50", 200).isErr()).toBeTruthy();
      expect(singleValidation("between:0,10", 6)).toBeTruthy();
      expect(singleValidation("between:0,20", [1, 2, 4]).isErr()).toBeTruthy();
    });

    test("boolean", () => {
      expect(singleValidation("boolean", true)).toBeTruthy();
      expect(singleValidation("boolean", false)).toBeTruthy();
      expect(singleValidation("boolean", "asd").isErr()).toBeTruthy();
      expect(singleValidation("boolean", 123).isErr()).toBeTruthy();
      expect(singleValidation("boolean", [1, 2]).isErr()).toBeTruthy();
      expect(singleValidation("boolean", { key: "value" }).isErr()).toBeTruthy();
    });

    test("confirmed", () => {
      expect(
        engine.api.validator.validate({ key: "value", key_confirmation: "value" }, { key: "confirmed" }),
      ).toBeTruthy();
      expect(engine.api.validator.validate({ key: "value" }, { key: "confirmed" }).isErr()).toBeTruthy();
      expect(
        engine.api.validator
          .validate(
            {
              key: "value",
              key_confirmation: "other_value",
            },
            { key: "confirmed" },
          )
          .isErr(),
      ).toBeTruthy();
    });

    test("date", () => {
      expect(singleValidation("date", "").isErr()).toBeTruthy();
      expect(singleValidation("date", "2016-05-28").isOk()).toBeTruthy();
    });

    test("different", () => {
      expect(
        engine.api.validator.validate({ key: "value", key2: "value2" }, { key: "different" }).isErr(),
      ).toBeTruthy();
      expect(
        engine.api.validator.validate({ key: "value", key2: "value" }, { key: "different:key2" }).isErr(),
      ).toBeTruthy();
      expect(
        engine.api.validator.validate({ key: "value", key2: "value2" }, { key: "different:key2" }).isOk(),
      ).toBeTruthy();
    });

    test("email", () => {
      expect(singleValidation("email", "").isErr()).toBeTruthy();
      expect(singleValidation("email", "user").isErr()).toBeTruthy();
      expect(singleValidation("email", "example.com").isErr()).toBeTruthy();
      expect(singleValidation("email", "user@example").isErr()).toBeTruthy();
      expect(singleValidation("email", "user@example.com").isOk()).toBeTruthy();
      expect(singleValidation("email", "user.surname@example.com").isOk()).toBeTruthy();
    });

    test("filled", () => {
      expect(singleValidation("filled", null).isErr()).toBeTruthy();
      expect(singleValidation("filled", "").isErr()).toBeTruthy();
      expect(singleValidation("filled", "value").isOk()).toBeTruthy();
    });

    test("in", () => {
      expect(singleValidation("in", "1").isErr()).toBeTruthy();
      expect(singleValidation("in", "1").unwrapErr()[0]).toBe("validator needs an array");

      expect(singleValidation("in:1,2,3", "1").isOk()).toBeTruthy();
      expect(singleValidation("in:1,2,3", "7").isErr()).toBeTruthy();
    });

    test("not_in", () => {
      expect(singleValidation("not_in", "1").isErr()).toBeTruthy();
      expect(singleValidation("not_in", "1").unwrapErr()[0]).toBe("validator needs an array");

      expect(singleValidation("not_in:1,2,3", "1").isErr()).toBeTruthy();
      expect(singleValidation("not_in:1,2,3", "7").isOk()).toBeTruthy();
    });

    test("integer", () => {
      expect(singleValidation("integer", "asd").isErr()).toBeTruthy();
      expect(singleValidation("integer", "123").isOk()).toBeTruthy();
      expect(singleValidation("integer", 123)).toBeTruthy();
    });

    test("ip", () => {
      expect(singleValidation("ip", "127.0.0.1").isOk()).toBeTruthy();
      expect(singleValidation("ip", "").isErr()).toBeTruthy();
    });

    test("json", () => {
      expect(singleValidation("json", "").isErr()).toBeTruthy();
      expect(singleValidation("json", "string").isErr()).toBeTruthy();
      expect(singleValidation("json", "123").isErr()).toBeTruthy();
      expect(singleValidation("json", 123).isErr()).toBeTruthy();
      expect(singleValidation("json", JSON.stringify({ key: "test", value: 123 }))).toBeTruthy();
    });

    test("max", () => {
      expect(singleValidation("max", "").unwrapErr()[0]).toBe("Validation rule max requires at least 1 parameters.");

      expect(singleValidation("numeric|max:10", 9)).toBeTruthy();
      expect(singleValidation("numeric|max:10", 10)).toBeTruthy();
      expect(singleValidation("numeric|max:10", 11).unwrapErr()[0]).toBe("The key may not be greater than 10.");
      expect(singleValidation("max:3", "as").isOk()).toBeTruthy();
      expect(singleValidation("max:3", "asd").isOk()).toBeTruthy();
      expect(singleValidation("max:3", "asdf").unwrapErr()[0]).toBe("The key may not be greater than 3 characters.");
      expect(singleValidation("array|max:3", [1, 2])).toBeTruthy();
      expect(singleValidation("array|max:3", [1, 2, 3])).toBeTruthy();
      expect(singleValidation("array|max:3", [1, 2, 3, 4]).unwrapErr()[0]).toBe(
        "The key may not have more than 3 items.",
      );
    });

    test("min", () => {
      expect(singleValidation("min", "").unwrapErr()[0]).toBe("Validation rule min requires at least 1 parameters.");
      expect(singleValidation("numeric|min:3", 2).unwrapErr()[0]).toBe("The key must be at least 3.");
      expect(singleValidation("numeric|min:3", 3)).toBeTruthy();
      expect(singleValidation("numeric|min:3", 4)).toBeTruthy();
      expect(singleValidation("min:3", "as").unwrapErr()[0]).toBe("The key must be at least 3 characters.");
      expect(singleValidation("min:3", "asd").isOk()).toBeTruthy();
      expect(singleValidation("min:3", "asdf").isOk()).toBeTruthy();
      expect(singleValidation("array|min:3", [1, 2]).unwrapErr()[0]).toBe("The key must have at least 3 items.");
      expect(singleValidation("array|min:3", [1, 2, 3])).toBeTruthy();
      expect(singleValidation("array|min:3", [1, 2, 3, 4])).toBeTruthy();
    });

    test("required", () => {
      expect(engine.api.validator.validate({}, { key: "required" }).isErr()).toBeTruthy();
      expect(singleValidation("required", "someValue").isOk()).toBeTruthy();
    });

    test("numeric", () => {
      expect(singleValidation("numeric", "asd").isErr()).toBeTruthy();
      expect(singleValidation("numeric", 123)).toBeTruthy();
      expect(singleValidation("numeric", 123.123)).toBeTruthy();
    });

    test("regex", () => {
      expect(singleValidation("regex", "asd").unwrapErr()[0]).toBe(
        "Validation rule regex requires at least 1 parameters.",
      );
      expect(singleValidation("regex:^\\d{3}$", "asd").unwrapErr()[0]).toBe("The key format is invalid.");
      expect(singleValidation("regex:^\\d{3}$", "123").isOk()).toBeTruthy();
    });

    test("required_if", () => {
      expect(
        engine.api.validator
          .validate(
            {
              key: "v1",
              key2: "v2",
            },
            { key: "required_if" },
          )
          .unwrapErr().key[0],
      ).toBe("Validation rule required_if requires at least 2 parameters.");
      expect(engine.api.validator.validate({ key2: "b" }, { key: "required_if:key2,v,v1,v2" }).isOk()).toBeTruthy();
      expect(
        engine.api.validator.validate({ key2: "v1" }, { key: "required_if:key2,v,v1,v2" }).unwrapErr().key[0],
      ).toBe("The key field is required when key2 is in v, v1, v2.");
      expect(engine.api.validator.validate({ key: "v1", key2: "v2" }, { key: "required_if:key2,v1" })).toBeTruthy();
    });

    test("required_unless", () => {
      expect(engine.api.validator.validate({ key: "" }, { key: "required_unless" }).unwrapErr().key[0]).toBe(
        "Validation rule required_unless requires at least 2 parameters.",
      );
      expect(
        engine.api.validator.validate({ key: "" }, { key: "required_unless:key2,val1,val2" }).unwrapErr().key[0],
      ).toBe("The key field is required unless key2 is in val1, val2.");
      expect(
        engine.api.validator
          .validate(
            {
              key: "",
              key2: "otherValue",
            },
            { key: "required_unless:key2,val1,val2" },
          )
          .unwrapErr().key[0],
      ).toBe("The key field is required unless key2 is in val1, val2.");
      expect(
        engine.api.validator.validate({ key: "notEmpty" }, { key: "required_unless:key2,val1,val2" }).isOk(),
      ).toBeTruthy();
      expect(
        engine.api.validator.validate({ key: "", key2: "val1" }, { key: "required_unless:key2,val1,val2" }).isOk(),
      ).toBeTruthy();
    });

    test("required_with", () => {
      expect(engine.api.validator.validate({ key: "" }, { key: "required_with" }).unwrapErr().key[0]).toBe(
        "Validation rule required_with requires at least 1 parameters.",
      );
      expect(engine.api.validator.validate({ key: "" }, { key: "required_with:name,surname" }).isOk()).toBeTruthy();
      expect(
        engine.api.validator
          .validate(
            {
              key: "",
              name: "Alec",
            },
            {
              key: "required_with:name,surname",
            },
          )
          .unwrapErr().key[0],
      ).toBe("The key field is required when at least one of name, surname is present.");
      expect(
        engine.api.validator
          .validate(
            {
              key: "someValue",
              name: "Alec",
            },
            { key: "required_with:name,surname" },
          )
          .isOk(),
      ).toBeTruthy();
    });

    test("required_with_all", () => {
      expect(engine.api.validator.validate({ key: "" }, { key: "required_with_all" }).unwrapErr().key[0]).toBe(
        "Validation rule required_with_all requires at least 2 parameters.",
      );
      expect(engine.api.validator.validate({ key: "" }, { key: "required_with_all:name,surname" }).isOk()).toBeTruthy();
      expect(
        engine.api.validator
          .validate(
            {
              key: "",
              name: "Alec",
            },
            { key: "required_with_all:name,surname" },
          )
          .isOk(),
      ).toBeTruthy();
      expect(
        engine.api.validator
          .validate(
            {
              key: "",
              name: "Alec",
              surname: "Sadler",
            },
            { key: "required_with_all:name,surname" },
          )
          .unwrapErr().key[0],
      ).toBe("The key field is required when name, surname are present.");
      expect(
        engine.api.validator
          .validate(
            {
              key: "someValue",
              name: "Alec",
              surname: "Sadler",
            },
            { key: "required_with_all:name,surname" },
          )
          .isOk(),
      ).toBeTruthy();
      expect(
        engine.api.validator.validate({ key: "someValue" }, { key: "required_with_all:name,surname" }).isOk(),
      ).toBeTruthy();
    });

    test("required_without", () => {
      expect(engine.api.validator.validate({ key: "" }, { key: "required_without" }).unwrapErr().key[0]).toBe(
        "Validation rule required_without requires at least 1 parameters.",
      );

      expect(
        engine.api.validator.validate({ key: "" }, { key: "required_without:name,surname" }).unwrapErr().key[0],
      ).toBe("The key field is required when at least one of name, surname is not present.");

      expect(
        engine.api.validator.validate({ key: "", name: "Alec" }, { key: "required_without:name,surname" }).unwrapErr()
          .key[0],
      ).toBe("The key field is required when at least one of name, surname is not present.");

      expect(
        engine.api.validator
          .validate({ key: "someValue", name: "Alec" }, { key: "required_without:name,surname" })
          .isOk(),
      ).toBeTruthy();

      expect(
        engine.api.validator
          .validate(
            {
              key: "someValue",
              name: "Alec",
              surname: "Sadler",
            },
            { key: "required_without:name,surname" },
          )
          .isOk(),
      ).toBeTruthy();
    });

    test("required_without_all", () => {
      expect(engine.api.validator.validate({ key: "" }, { key: "required_without_all" }).unwrapErr().key[0]).toBe(
        "Validation rule required_without_all requires at least 2 parameters.",
      );

      expect(
        engine.api.validator.validate({ key: "" }, { key: "required_without_all:name,surname" }).unwrapErr().key[0],
      ).toBe("The key field is required when none of name, surname are present.");

      expect(
        engine.api.validator.validate({ key: "", name: "Alec" }, { key: "required_without_all:name,surname" }).isOk(),
      ).toBeTruthy();

      expect(
        engine.api.validator
          .validate(
            {
              key: "",
              name: "Alec",
              surname: "Sadler",
            },
            { key: "required_without_all:name,surname" },
          )
          .isOk(),
      ).toBeTruthy();

      expect(
        engine.api.validator
          .validate(
            {
              key: "someValue",
              name: "Alec",
              surname: "Sadler",
            },
            { key: "required_without_all:name,surname" },
          )
          .isOk(),
      ).toBeTruthy();
      expect(
        engine.api.validator.validate({ key: "someValue" }, { key: "required_without_all:name,surname" }).isOk(),
      ).toBeTruthy();
    });

    test("same", () => {
      expect(engine.api.validator.validate({ key: "" }, { key: "same" }).unwrapErr().key[0]).toBe(
        "Validation rule same requires at least 1 parameters.",
      );

      expect(
        engine.api.validator.validate({ pass: "test", opass: "test" }, { pass: "same:opass" }).isOk(),
      ).toBeTruthy();

      expect(
        engine.api.validator.validate({ pass: "test", opass: "test__" }, { pass: "same:opass" }).unwrapErr().pass[0],
      ).toBe("The pass and opass must match.");
    });

    test("size", () => {
      expect(singleValidation("size", "value").unwrapErr()[0]).toBe(
        "Validation rule size requires at least 1 parameters.",
      );

      expect(singleValidation("size:4", "qwe").unwrapErr()[0]).toBe("The key must be 4 characters.");
      expect(singleValidation("size:4", "qwer").isOk()).toBeTruthy();
      expect(singleValidation("size:4", "qwert").unwrapErr()[0]).toBe("The key must be 4 characters.");
      expect(singleValidation("numeric|size:4", 3).unwrapErr()[0]).toBe("The key must be 4.");
      expect(singleValidation("numeric|size:4", 4).isOk()).toBeTruthy();
      expect(singleValidation("numeric|size:4", 5).unwrapErr()[0]).toBe("The key must be 4.");
      expect(singleValidation("array|size:4", [1, 2, 3]).unwrapErr()[0]).toBe("The key must contain 4 items.");
      expect(singleValidation("array|size:4", [1, 2, 3, 4]).isOk()).toBeTruthy();
      expect(singleValidation("array|size:4", [1, 2, 3, 4, 5]).unwrapErr()[0]).toBe("The key must contain 4 items.");
    });

    test("url", () => {
      expect(singleValidation("url", "//some/thing").unwrapErr()[0]).toBe("The key format is invalid.");
      expect(singleValidation("url", "https://gilmendes.wordpress.com").isOk()).toBeTruthy();
      expect(singleValidation("url", "https://duckduckgo.com/?q=stellar&t=osx&ia=meanings").isOk()).toBeTruthy();
    });
  });
});
