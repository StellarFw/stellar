import { Result } from "..";

/**
 * Type signature of a validator function.
 */
export type ValidatorFunction = <T>(value: T) => Result<boolean, string>;

/**
 * Validator rules.
 */
export interface ValidatorRules {
  [key: string]: string | RegExp | ValidatorFunction;
}

/**
 * Validator rules after being parsed.
 */
export interface ParsedRules {
  [field: string]: { [validator: string]: Array<string> };
}

/**
 * Holds validation errors.
 */
export interface ValidatorErrors {
  [field: string]: Array<string>;
}

export interface IValidatorSatellite {
  /**
   * Check if the given name corresponds with a validator.
   *
   * @param name
   */
  isValidator(name: string): boolean;

  /**
   * Run the validator's rules gains the data.
   *
   * @param data Hash with the data to be validated.
   * @param rules Hash with the rules who the data will be validated against with.
   */
  validate<T>(data: T, rules: ValidatorRules): Result<true, ValidatorErrors>;

  // --- Validators

  /**
   * Check if the value is a string only with alpha characters./
   */
  validatorAlpha<T>(value: T): Result<boolean, string>;

  /**
   * Check if the value is a number.
   */
  validatorAlphaNum<T>(value: T): Result<boolean, string>;

  /**
   * Check if the value is a string only with alpha or (_, -) characters.
   */
  validatorAlphaDash<T>(value: T): Result<boolean, string>;

  /**
   * Check if the value is an array.
   */
  validatorArray<T>(value: T): Result<boolean, string>;

  /**
   * Check if the value is before than the specified date.
   *
   * @param value
   * @param args Reference time.
   */
  validatorBefore<T>(value: T, args: Array<number | string>): Result<boolean, string>;

  /**
   * Check if the value is after than the specified date.
   *
   * @param value
   * @param args reference time
   */
  validatorAfter<T>(value: T, args: Array<number | string>): Result<boolean, string>;

  /**
   * Check if the value is between two values.
   *
   * When is a string will use the length of it to do the validation.
   *
   * @param value
   * @param args Reference dates
   */
  validatorBetween<T>(value: T, args: Array<number | string>): Result<boolean, string>;

  /**
   * Check if the value is a boolean.
   *
   * @param value
   */
  validatorBoolean<T>(value: T): Result<boolean, string>;

  /**
   * Check if exists a confirmation fields to the testing key with the same name.
   *
   * @param value
   * @param _
   * @param field
   * @param data
   */
  validatorConfirmed<T, D>(value: T, _: unknown, field: string, data: D): Result<boolean, string>;

  /**
   * Check ifn the given value is a valid JS date.
   *
   * @param value
   */
  validatorDate(value: string | number): Result<boolean, string>;

  /**
   * Check if the value is different of the other field.
   *
   * @param value
   * @param args
   */
  validatorDifferent<T, D>(value: T, args: [string], _: unknown, data: D): Result<boolean, string>;

  /**
   * Check if the value is an email.
   *
   * @param value
   */
  validatorEmail(value: string): Result<boolean, string>;

  /**
   * Check if the value is filled.
   *
   * @param value
   */
  validatorFilled<T>(value: T): Result<boolean, string>;

  /**
   * Check if the value are included in the array.
   *
   * @param value
   * @param args
   */
  validatorIn<T>(value: T, args: Array<T>): Result<boolean, string>;

  /**
   * Check if the value are not included in the array.
   *
   * @param value
   * @param args
   */
  validatorNotIn<T>(value: T, args: Array<T>): Result<boolean, string>;

  /**
   * Check if the value is an integer.
   *
   * @param value
   */
  validatorInteger<T>(value: T): Result<boolean, string>;

  /**
   * Check if the value is an IP.
   *
   * @param value
   */
  validatorIp(value: string): Result<boolean, string>;

  /**
   * Check if the field is a valid JSON.
   *
   * @param value
   */
  validatorJson(value: string): Result<boolean, string>;

  /**
   * Check if the parameter match with a max value.
   */
  validatorMax<T>(value: T, args: [number]): Result<boolean, string>;

  /**
   * Check if the parameter match with a min value.
   *
   * @param value
   * @param args
   */
  validatorMin<T>(value: T, args: [number]): Result<boolean, string>;

  /**
   * Check if the value exists.
   *
   * @param value
   */
  validatorRequired<T>(value: T): Result<boolean, string>;

  /**
   * Check if the value matches with a regular expression.
   *
   * @param value
   * @param parameters
   */
  validatorRegex<T>(value: T, parameters: [string | RegExp, string?]): Result<boolean, string>;

  /**
   * Check if the value is numeric.
   *
   * @param value
   */
  validatorNumeric<T>(value: T): Result<boolean, string>;

  /**
   * Check if the field is required taking into account the parameters.
   *
   * @param value
   * @param args
   */
  validatorRequiredIf<T, D>(value: T, args: [string], _: unknown, data: D): Result<boolean, string>;

  /**
   * The field under validation must be present unless the args[0] is equal to any value.
   *
   * @param value
   * @param args
   */
  validatorRequiredUnless<T, D>(value: T, args: [string], _: unknown, data: D): Result<boolean, string>;

  /**
   * The field under validation must be present only if any of the other specified fields are present.
   *
   * @param value
   * @param args
   */
  validatorRequiredWith<T, D>(value: T, args: Array<string>, _: unknown, data: D): Result<boolean, string>;

  /**
   * The field under validation must be present only if all of the other specified fields are present.
   *
   * @param value
   * @param args
   */
  validatorRequiredWithAll<T, D>(value: T, args: Array<string>, _: unknown, data: D): Result<boolean, string>;

  /**
   * The field under validation must be present only when any of the other specified fields are not present.
   *
   * @param value
   * @param args
   */
  validatorRequiredWithout<T, D>(value: T, args: Array<string>, _: unknown, data: D): Result<boolean, string>;

  /**
   * The field under validation must be present only when all of the other specified fields are not present.
   *
   * @param value
   * @param args
   */
  validatorRequiredWithoutAll<T, D>(value: T, args: Array<string>, _: unknown, data: D): Result<boolean, string>;

  /**
   * The given field must match the field under validation.
   *
   * @param value
   * @param args
   */
  validatorSame<T, D>(value: T, args: [string], _: unknown, data: D): Result<boolean, string>;

  /**
   * The field under validation must have a size matching the given value.
   *
   * @param value
   * @param args
   */
  validatorSize<T>(value: T, args: [number]): Result<boolean, string>;

  /**
   * The field under validation must be a valid URL.
   *
   * @param value
   */
  validatorUrl(value: string): Result<boolean, string>;
}
