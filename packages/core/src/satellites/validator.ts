import {
  API,
  err,
  IValidatorSatellite,
  ok,
  panic,
  Result,
  Satellite,
  ValidatorErrors,
  ValidatorFunction,
  ValidatorRules,
  ParsedRules,
  safeReadFile,
} from "@stellarfw/common/lib/index.js";

import { stellarPkgPath } from "../engine.js";

/**
 * Base error messages for each validator.
 */
const Messages = (
  await safeReadFile(`${stellarPkgPath}/base/validator-messages.json`)
    .map((wrapper) => wrapper.then((result) => result.map((content) => JSON.parse(content.toString()))))
    .run()
).unwrap();

/**
 * Require a certain number of parameters to be present.
 *
 * @param Number int
 * @param Array parameters
 * @param String rule
 */
const requireParameterCount = <T>(count: number, parameters: Array<T>, rule: string): Result<true, string> =>
  !parameters || parameters.length < count
    ? err(`Validation rule ${rule} requires at least ${count} parameters.`)
    : ok(true);

/**
 * Parse the rules and return a structured hash with all information.
 */
const parseRules = (rules: ValidatorRules): ParsedRules =>
  Object.keys(rules).reduce((result, fieldName) => {
    const fieldRule = rules[fieldName];

    // when the validator is a function
    if (typeof fieldRule === "function") {
      return { ...result, [fieldName]: { function: [] } };
    }

    // when the validator is a regular expression
    if (fieldRule instanceof RegExp) {
      return { ...result, [fieldName]: { regex: [fieldRule.source, fieldRule.flags] } };
    }

    // each validator is separated by a pipe, split by it and process each one of them individually
    const fieldParsedRules = fieldRule.split("|").reduce((rules, validatorEntry) => {
      // some validators have arguments, those arguments are passed after a ":" char. If the validator has multiple
      // arguments they can be specified by using a comma
      const parts = validatorEntry.split(":");
      return parts[1] ? { ...rules, [parts[0]]: parts[1].split(",") } : { ...rules, [parts[0]]: [] };
    }, {});
    return { ...result, [fieldName]: fieldParsedRules };
  }, {});

/**
 * Normalize a rule name.
 */
const normalizeRuleName = (ruleName: string, api: API): string => {
  const camelCase = api.utils.snakeToCamel(ruleName);
  return camelCase.charAt(0).toUpperCase() + camelCase.slice(1);
};

/**
 * This class allow developers testes values against a set of validators.
 *
 * This is used by the ActionProcessor to validator the action input params.
 *
 * You can use this manually like this:
 *
 * <code>
 *   api.validator.validate(validatorString, params, keyToValidate)
 * </code>
 */
export default class ValidatorSatellite extends Satellite implements IValidatorSatellite {
  protected _name = "validator";
  public loadPriority = 400;

  /**
   * Array with the implicit validators.
   */
  public implicitValidators: Array<string> = [
    "required_if",
    "required",
    "required_unless",
    "filled",
    "required_with",
    "required_with_all",
    "required_without",
    "required_without_all",
  ];

  /**
   * The size related validation rules.
   */
  public sizeRules: Array<string> = ["size", "between", "min", "max"];

  /**
   * Check if it is a valid validator.
   */
  isValidator(name: string): boolean {
    return this[`validator${name}`] !== undefined;
  }

  /**
   * Replace all error message place-holders with actual values.
   *
   * @param String message
   * @param String attribute
   * @param String rule
   * @param Array parameters
   */
  private doReplacements(message: string, attribute: string, _rule: string, parameters: Array<any>) {
    message = message.replace(/:attribute/gi, attribute);

    const rule = normalizeRuleName(_rule, this.api);

    // check if there is a specific replacer for this type of rule
    const replacerMethod = `replace${rule}`;
    if (this[replacerMethod] !== undefined) {
      message = this[replacerMethod](message, attribute, rule, parameters);
    }

    return message;
  }

  private getMessage(rules: ParsedRules, attribute, rule) {
    // check if is a size rule
    if (this.sizeRules.indexOf(rule) > -1) {
      let type: string;

      if (this.attributeHasRule(rules, attribute, "numeric")) {
        type = "numeric";
      } else if (this.attributeHasRule(rules, attribute, "array")) {
        type = "array";
      } else {
        type = "string";
      }

      return Messages[rule][type];
    }

    return Messages[rule];
  }

  /**
   * This check if one attribute has a specific rule.
   */
  private attributeHasRule(rules: ParsedRules, attribute: string, rule: string) {
    return rules[attribute]?.[rule] ?? false;
  }

  /**
   * Add an error message to the errors hash.
   *
   * TODO: add support for translation.
   */
  private addFailure(
    errors: Array<string>,
    rules: ParsedRules,
    attribute: string,
    rule: string,
    parameters: Array<string>,
  ): Array<string> {
    // get the error message from the default error message catalog
    let message = this.getMessage(rules, attribute, rule);

    // if there is no message for the validator throw an error
    if (message === undefined) {
      panic(`No error message was been specified for the '${rule}' validator`);
    }

    // replace the fields on the error message
    message = this.doReplacements(message, attribute, rule, parameters);

    return [...errors, message];
  }

  /**
   * Run the validator's rules against its data.
   *
   * @param Object data   Hash with the data to be validated.
   * @param Object rules  Hash with the rules who the data will be validated
   *                      against with.
   */
  public validate<T>(data: T, paramRules: ValidatorRules): Result<true, ValidatorErrors> {
    // parse rules to make it easier to work with them
    const rules = parseRules(paramRules);

    const finalErrors = Object.keys(rules).reduce((errors: ValidatorErrors, fieldName) => {
      // iterate all the rules associated with the current field
      const fieldRules = rules[fieldName];

      const fieldErrors = Object.keys(fieldRules).reduce((fieldErrors: Array<string>, ruleName: string) => {
        // the validation can be a function. We must do all the validation here.
        if (ruleName === "function") {
          return (paramRules.function as ValidatorFunction)(data[fieldName]).match({
            err: (errorMsg) => [...fieldErrors, errorMsg],
            // when a validation function returns Ok, doesn't mean the value is valid. If it returns `false`, we must
            // add an error message.
            ok: (validationResult) =>
              !validationResult
                ? [...fieldErrors, `The ${fieldName} field do not match with the validator function.`]
                : fieldErrors,
          });
        }

        const ruleNameNormalized = normalizeRuleName(ruleName, this.api);

        // before continue we check if the validator exists
        if (!this.isValidator(ruleNameNormalized)) {
          panic(`The is no validator named '${ruleName}'`);
        }

        // execute the correspondent validator and if the response if `false` or `Err` a  failure message will be added
        // to the errors object.
        const value = data[fieldName];
        const ruleArgs = fieldRules[ruleName];

        return (
          this[`validator${ruleNameNormalized}`](value, ruleArgs, fieldName, data, rules) as Result<boolean, string>
        ).match({
          err: (errorMsg) => [...fieldErrors, errorMsg],
          ok: (v) => (v === false ? this.addFailure(fieldErrors, rules, fieldName, ruleName, ruleArgs) : fieldErrors),
        });
      }, []);

      return fieldErrors.length === 0 ? errors : { ...errors, [fieldName]: fieldErrors };
    }, {});

    return Object.keys(finalErrors).length === 0 ? ok(true) : err(finalErrors);
  }

  // --------------------------------------------------------------------------- [Validators]

  /**
   * Check if the value is a string only with alpha characters.
   *
   * @param value
   * @returns {boolean}
   */
  public validatorAlpha(value): Result<boolean, string> {
    return ok(typeof value === "string" && /^[a-zA-Z]*$/.test(value));
  }

  /**
   * Check if the value is a number.
   *
   * @param value
   * @returns {boolean}
   */
  public validatorAlphaNum(value): Result<boolean, string> {
    return ok(/^[a-zA-Z0-9]*$/.test(value));
  }

  /**
   * Check if the value is a string only with alpha or (_, -) characters.
   *
   * @param value
   * @returns {boolean}
   */
  public validatorAlphaDash(value): Result<boolean, string> {
    return ok(/^[a-zA-Z0-9-_]*$/.test(value));
  }

  /**
   * Check if the value is an array.
   *
   * @param value
   * @returns {boolean}
   */
  public validatorArray(value): Result<boolean, string> {
    return ok(Array.isArray(value));
  }

  /**
   * Check if the value is before than the specified date.
   *
   * @param value
   * @param args
   * @returns {*}
   */
  public validatorBefore(value, args): Result<boolean, string> {
    const paramRes = requireParameterCount(1, args, "before");
    if (paramRes.isErr()) {
      return paramRes;
    }

    // check if the argument are valid
    if (isNaN(Date.parse(args[0]))) {
      return err("The specified argument is not a valid date");
    }

    // check if the value if a date
    if (isNaN(Date.parse(value))) {
      return ok(false);
    }

    // check if the specified date is less than the required date
    return ok(Date.parse(value) < Date.parse(args));
  }

  public validatorAfter(value, args): Result<boolean, string> {
    const paramRes = requireParameterCount(1, args, "after");
    if (paramRes.isErr()) {
      return paramRes;
    }

    // check if the argument are valid
    if (isNaN(Date.parse(args[0]))) {
      return err("The specified argument is not a valid date");
    }

    // check if the argument are valid
    if (isNaN(Date.parse(args))) {
      return ok(false);
    }

    // check if the specified date is greater than the required date
    return ok(Date.parse(value) > Date.parse(args));
  }

  /**
   * Check if the value is between the two intervals.
   *
   * @param value
   * @param args
   * @returns {*}
   */
  public validatorBetween(value, args): Result<boolean, string> {
    const paramsRes = requireParameterCount(2, args, "between");
    if (paramsRes.isErr()) {
      return paramsRes;
    }

    // check if the value is valid
    if (typeof value === "string") {
      return ok(value.length >= args[0] && value.length <= args[1]);
    } else if (typeof value === "number") {
      return ok(value >= args[0] && value <= args[1]);
    }

    return ok(false);
  }

  /**
   * Check if the value is a boolean.
   *
   * @param value
   * @returns {boolean}
   */
  public validatorBoolean(value): Result<boolean, string> {
    return ok(typeof value === "boolean");
  }

  /**
   * Check if exists a confirmation fields to the testing key with the same name.
   *
   * @param value
   * @param args
   * @param key
   * @returns {*}
   */
  public validatorConfirmed<T, D>(value: T, _: unknown, field: string, data: D): Result<boolean, string> {
    // build the confirmation field name
    const confirmationFieldName = `${field}_confirmation`;

    // check if the confirmation field are not present
    if (data[confirmationFieldName] === undefined) {
      return ok(false);
    }

    // check if the values of two fields match
    if (data[confirmationFieldName] !== value) {
      return ok(false);
    }

    return ok(true);
  }

  /**
   * Check if the param is a date.
   *
   * @param value
   * @returns {*}
   */
  public validatorDate(value): Result<boolean, string> {
    return ok(!isNaN(Date.parse(value)));
  }

  /**
   * Check if the value is different of the other field.
   *
   * @param value
   * @param args
   * @returns {*}
   */
  public validatorDifferent<T, D>(value: T, args: [string], _: unknown, data: D): Result<boolean, string> {
    const paramsRes = requireParameterCount(1, args, "different");
    if (paramsRes.isErr()) {
      return paramsRes;
    }

    return ok(value !== data[args[0]]);
  }

  /**
   * Check if the value is an email.
   *
   * @param value
   * @returns {boolean}
   */
  public validatorEmail(value): Result<boolean, string> {
    return ok(
      /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(
        value,
      ),
    );
  }

  /**
   * Check if the value is filled.
   *
   * @param value
   * @returns {boolean}
   */
  public validatorFilled(value): Result<boolean, string> {
    return ok(value !== undefined && value !== null && value !== "");
  }

  /**
   * Check if the value are included in the array.
   *
   * @param value
   * @param args
   * @returns {*}
   */
  public validatorIn(value, args): Result<boolean, string> {
    if (args.length === 0) {
      return err("validator needs an array");
    }

    // check if the array contains the value
    return ok(args.indexOf(String(value)) > -1);
  }

  /**
   * Check if the value are not included in the array.
   *
   * @param value
   * @param args
   * @returns {*}
   */
  public validatorNotIn(value, args): Result<boolean, string> {
    if (args.length === 0) {
      return err("validator needs an array");
    }

    // check if the array not contains the value
    return ok(args.indexOf(String(value)) === -1);
  }

  /**
   * Check if the value is an integer.
   *
   * @param value
   * @returns {boolean}
   */
  public validatorInteger(value): Result<boolean, string> {
    // try parse to pin
    const parsedValue = Number.parseInt(value);

    // check if is a number
    return ok(Number.isInteger(parsedValue));
  }

  /**
   * Check if the value is an IP.
   *
   * @param value
   * @returns {boolean}
   */
  public validatorIp(value): Result<boolean, string> {
    return ok(/^(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|$)){4}$/.test(value));
  }

  /**
   * Check if the field is a valid JSON.
   *
   * @param value
   * @returns {boolean}
   */
  public validatorJson(value): Result<boolean, string> {
    try {
      const o = JSON.parse(value);

      if (o && typeof o === "object" && o !== null) {
        return ok(true);
      }
    } catch (e) {}

    return ok(false);
  }

  /**
   * Check if the parameter match with a max value.
   *
   * @param value
   * @param args
   * @returns {*}
   */
  public validatorMax(value, args): Result<boolean, string> {
    const paramsRes = requireParameterCount(1, args, "max");
    if (paramsRes.isErr()) {
      return paramsRes;
    }

    if (typeof value === "string" || value instanceof Array) {
      return ok(value.length <= args[0]);
    } else if (typeof value === "number") {
      return ok(value <= args[0]);
    }
    return ok(false);
  }

  /**
   * Check if the parameter match with a min value.
   *
   * @param value
   * @param args
   * @returns {*}
   */
  public validatorMin(value, args): Result<boolean, string> {
    const paramsRes = requireParameterCount(1, args, "min");
    if (paramsRes.isErr()) {
      return paramsRes;
    }

    if (typeof value === "string" || value instanceof Array) {
      return ok(value.length >= args[0]);
    } else if (typeof value === "number") {
      return ok(value >= args[0]);
    }

    return ok(false);
  }

  /**
   * Check if the value exists.
   *
   * @param value
   * @returns {boolean}
   */
  public validatorRequired(value): Result<boolean, string> {
    return ok(value !== undefined);
  }

  /**
   * Check if the value matches with a regular expression.
   *
   * @param Mixed value
   * @param Array parameters
   */
  public validatorRegex(value, parameters): Result<boolean, string> {
    const paramsRes = requireParameterCount(1, parameters, "regex");
    if (paramsRes.isErr()) {
      return paramsRes;
    }

    // create an RegEx instance and validate
    const regex = new RegExp(parameters[0], parameters[1] || "");
    return ok(regex.test(value));
  }

  /**
   * Check if the value is numeric.
   *
   * @param value
   * @returns {boolean}
   */
  public validatorNumeric(value): Result<boolean, string> {
    return ok(typeof value === "number");
  }

  /**
   * Check if the field is required taking into account the parameters.
   *
   * @param value
   * @param args
   * @returns {*}
   */
  public validatorRequiredIf<T, D>(value: T, args: [string], _: unknown, data: D): Result<boolean, string> {
    const paramsRes = requireParameterCount(2, args, "required_if");
    if (paramsRes.isErr()) {
      return paramsRes;
    }

    // if the args[0] param value is present in the values array the value is required
    if (args.indexOf(String(data[args[0]])) > -1) {
      return this.validatorFilled(value);
    }

    return ok(true);
  }

  /**
   * The field under validation must be present unless the args[0] is equal to any value.
   *
   * @param value
   * @param args
   * @returns {*}
   */
  public validatorRequiredUnless<T, D>(value: T, args: [string], _: unknown, data: D): Result<boolean, string> {
    const paramsRes = requireParameterCount(2, args, "required_unless");
    if (paramsRes.isErr()) {
      return paramsRes;
    }

    // if the parameter not have a valid value the current parameter is required
    if (args.indexOf(String(data[args[0]])) === -1) {
      return this.validatorFilled(value);
    }

    return ok(true);
  }

  /**
   * The field under validation must be present only if any of the other
   * specified fields are present.
   *
   * @param value
   * @param args
   * @returns {*}
   */
  public validatorRequiredWith<T, D>(value: T, args: Array<string>, _: unknown, data: D): Result<boolean, string> {
    const paramsRes = requireParameterCount(1, args, "required_with");
    if (paramsRes.isErr()) {
      return paramsRes;
    }

    // check if one of the parameters are present
    for (const index in args) {
      if (!args.hasOwnProperty(index)) {
        continue;
      }

      const paramName = args[index];
      if (data[paramName] !== undefined) {
        return this.validatorFilled(value);
      }
    }

    return ok(true);
  }

  /**
   * The field under validation must be present only if all of the other
   * specified fields are present.
   *
   * @param value
   * @param args
   * @returns {*}
   */
  public validatorRequiredWithAll<T, D>(value: T, args: Array<string>, _: unknown, data: D): Result<boolean, string> {
    const paramsRes = requireParameterCount(2, args, "required_with_all");
    if (paramsRes.isErr()) {
      return paramsRes;
    }

    // check if all the parameters are present
    for (const index in args) {
      if (!args.hasOwnProperty(index)) {
        continue;
      }

      const paramName = args[index];
      if (data[paramName] === undefined) {
        return ok(true);
      }
    }

    // if all the fields are present the fields under validation is required
    return this.validatorFilled(value);
  }

  /**
   * The field under validation must be present only when any of the other
   * specified fields are not present.
   *
   * @param value
   * @param args
   * @returns {*}
   */
  public validatorRequiredWithout<T, D>(value: T, args: Array<string>, _: unknown, data: D): Result<boolean, string> {
    const paramsRes = requireParameterCount(1, args, "required_without");
    if (paramsRes.isErr()) {
      return paramsRes;
    }

    // if one of the fields are not present the field under validation is required
    for (const index in args) {
      if (!args.hasOwnProperty(index)) {
        continue;
      }

      const paramName = args[index];
      if (data[paramName] === undefined) {
        return this.validatorFilled(value);
      }
    }

    return ok(true);
  }

  /**
   * The field under validation must be present only when all of the other
   * specified fields are not present.
   *
   * @param value
   * @param args
   * @returns {*}
   */
  public validatorRequiredWithoutAll<T, D>(
    value: T,
    args: Array<string>,
    _: unknown,
    data: D,
  ): Result<boolean, string> {
    const paramsRes = requireParameterCount(2, args, "required_without_all");
    if (paramsRes.isErr()) {
      return paramsRes;
    }

    for (const index in args) {
      if (!args.hasOwnProperty(index)) {
        continue;
      }

      const paramName = args[index];

      // if one of the fields are not present we can stop right here
      if (data[paramName] !== undefined) {
        return ok(true);
      }
    }

    return this.validatorFilled(value);
  }

  /**
   * The given field must match the field under validation.
   *
   * @param value
   * @param args
   * @returns {*}
   */
  public validatorSame<T, D>(value: T, args: [string], _: unknown, data: D): Result<boolean, string> {
    const paramsRes = requireParameterCount(1, args, "same");
    if (paramsRes.isErr()) {
      return paramsRes;
    }

    return ok(data[args[0]] === value);
  }

  /**
   * The field under validation must have a size matching the given value.
   *
   * @param value
   * @param args
   */
  public validatorSize(value, args: Array<any>): Result<boolean, string> {
    const paramsRes = requireParameterCount(1, args, "size");
    if (paramsRes.isErr()) {
      return paramsRes;
    }

    const length = parseInt(args[0], 10);

    if (typeof value === "string" || value instanceof Array) {
      return ok(value.length === length);
    } else if (typeof value === "number") {
      return ok(value === length);
    }

    return ok(false);
  }

  /**
   * The field under validation must be a valid URL.
   *
   * @param value
   * @returns {boolean}
   */
  public validatorUrl(value: string): Result<boolean, string> {
    return ok(/^(http|ftp|https):\/\/[\w-]+(\.[\w-]*)+([\w.,@?^=%&amp;:/~+#-]*[\w@?^=%&amp;/~+#-])?$/.test(value));
  }

  // --------------------------------------------------------------------------- [Replacers]

  /**
   * Replace all place-holders for the before rule.
   */
  public replaceBefore(message, attribute, rule, parameters) {
    return message.replace(/:date/gi, parameters[0]);
  }

  /**
   * Replace all place-holders for the between rule.
   */
  public replaceBetween(message, attribute, rule, parameters) {
    const repl = { ":min": parameters[0], ":max": parameters[1] };
    return message.replace(/:min|:max/gi, (match) => repl[match]);
  }

  /**
   * Replace all place-holders for the different rule.
   */
  public replaceDifferent(message, attribute, rule, parameters) {
    return message.replace(/:other/gi, parameters[0]);
  }

  /**
   * Replace all place-holders for the max rule.
   */
  public replaceMax(message, attribute, rule, parameters) {
    return message.replace(/:max/gi, parameters[0]);
  }

  /**
   * Replace all place-holders for the min rule.
   */
  public replaceMin(message, attribute, rule, parameters) {
    return message.replace(/:min/gi, parameters[0]);
  }

  /**
   * Replace all place-holders for the required_if rule.
   */
  public replaceRequiredIf(message, attribute, rule, parameters) {
    const params = JSON.parse(JSON.stringify(parameters));
    params.shift();

    const repl = { ":other": parameters[0], ":values": params.join(", ") };
    return message.replace(/:other|:values/gi, (match) => repl[match]);
  }

  /**
   * Replace all place-holders for the required_unless rule.
   */
  public replaceRequiredUnless(message, attribute, rule, parameters) {
    const params = JSON.parse(JSON.stringify(parameters));
    params.shift();

    const repl = { ":other": parameters[0], ":values": params.join(", ") };
    return message.replace(/:other|:values/gi, (match) => repl[match]);
  }

  /**
   * Replace all place-holders for the required_with rule.
   */
  public replaceRequiredWith(message, attribute, rule, parameters) {
    return message.replace(/:values/gi, parameters.join(", "));
  }

  /**
   * Replace all place-holders for the required_with_all rule.
   */
  public replaceRequiredWithAll(message, attribute, rule, parameters) {
    return message.replace(/:values/gi, parameters.join(", "));
  }

  /**
   * Replace all place-holders for the required_without rule.
   */
  public replaceRequiredWithout(message, attribute, rule, parameters) {
    return message.replace(/:values/gi, parameters.join(", "));
  }

  /**
   * Replace all place-holders for the required_without_all rule.
   */
  public replaceRequiredWithoutAll(message, attribute, rule, parameters) {
    return message.replace(/:values/gi, parameters.join(", "));
  }

  /**
   * Replace all place-holders for the same rule.
   */
  public replaceSame(message, attribute, rule, parameters) {
    return message.replace(/:other/i, parameters[0]);
  }

  /**
   * Replace all place-holders for the size rule.
   */
  public replaceSize(message, attribute, rule, parameters) {
    return message.replace(/:size/i, parameters[0]);
  }

  public async load(): Promise<void> {
    this.api.validator = this;
  }
}
