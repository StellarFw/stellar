import { Option } from "../option/option.interface";

/**
 * Define a contract to unwrap Option objects.
 */
export interface IResultPattern<T, E, O> {
  /**
   * Function to handle when is an Ok value.
   */
  ok(val: NonNullable<T>): O;

  /**
   * Function to handle when a value is an Err.
   */
  err(val: NonNullable<E>): O;
}

/**
 * Interface that describe a structure that handlers error and their propagation.
 */
interface IResult<T, E> {
  /**
   * Returns true if the result is Ok.
   */
  isOk(): boolean;

  /**
   * Returns true if the result is Err.
   */
  isErr(): boolean;

  /**
   * Returns true if the result is an Ok value containing the given value.
   */
  contains(x: T): boolean;

  /**
   * Returns true if the result is an Err value containing the given value.
   *
   * @param f
   */
  containsErr(f: E): boolean;

  /**
   * Converts from Result<T, E> to Option<T>.
   *
   * Converts this into an Option<T>, consuming this, and discarding the error, if any.
   */
  ok(): Option<T>;

  /**
   * Converts from Result<T, E> to Option<E>.
   *
   * Converts this into an Option<E>, consuming this, and discarding the success value, if any.
   */
  err(): Option<E>;

  /**
   * Maps a Result<T, E> to Result<U, E> by applying a function to a contained Ok value, leaving an Err value untouched.
   *
   * This function can be used to compose the results of two functions.
   *
   * @param f
   */
  map<U>(f: (val: T) => U): Result<U, E>;

  /**
   * Applies a function to the contained value (if Ok), or returns the provided default (if Err).
   *
   * Arguments passed to mapOr are eagerly evaluated; if you are passing the result of a function call, it is
   * recommended to use mapOrElse, which is lazily evaluated.
   *
   * @param defaultVal
   * @param f
   */
  mapOr<U>(defaultVal: U, f: (val: T) => U): U;

  /**
   * Maps a Result<T, E> to U by applying a function to a contained Ok value, or a fallback function to a contained Err
   * value.
   *
   * This function can be used to unpack a successful result while handling an error.
   *
   * @param defaultF
   * @param f
   */
  mapOrElse<U>(defaultF: (val: E) => U, f: (val: T) => U): U;

  /**
   * Maps a Result<T, E> to Result<T, F> by applying a function to a contained Err value, leaving an Ok value untouched.
   *
   * This function can be used to pass through a successful result while handling an error.
   *
   * @param op
   */
  mapErr<F>(op: (val: E) => F): Result<T, F>;

  /**
   * Returns res if the result is Ok, otherwise returns the Err value of self.
   *
   * @param res
   */
  and<U>(res: Result<U, E>): Result<U, E>;

  /**
   * Calls op if the result is Ok, otherwise returns the Err value of self.
   *
   * This function can be used for control flow based on Result values.
   *
   * @param op
   */
  andThen<U>(op: (val: T) => Result<U, E>): Result<U, E>;

  /**
   * Returns res if the result is Err, otherwise returns the Ok value of self.
   *
   * Arguments passed to or are eagerly evaluated; if you are passing the result of a function call, it is recommended
   * to use orElse, which is lazily evaluated.
   *
   * @param res
   */
  or<F>(res: Result<T, F>): Result<T, F>;

  /**
   * Calls op if the result is Err, otherwise returns the Ok value of self.
   *
   * This function can be used for control flow based on result values.
   *
   * @param op
   */
  orElse<F>(op: (val: E) => Result<T, F>): Result<T, F>;

  /**
   * Returns the contained Ok value or a provided default.
   *
   * Arguments passed to unwrapOr are eagerly evaluated; if you are passing the result of a function call, it is
   * recommended to use unwrapOrElse, which is lazily evaluated.
   *
   * @param defaultVal
   */
  unwrapOr(defaultVal: T): T;

  /**
   * Returns the contained Ok value or computes it from a closure.
   *
   * @param op
   */
  unwrapOrElse(op: (val: E) => T): T;

  /**
   * Returns the contained Ok value, consuming the self value.
   *
   * Panics if the value is an Err, with a panic message including the passed message, and the content of the Err.
   *
   * @param msg
   */
  expect(msg: string): T;

  /**
   * Returns the contained Ok value, consuming the self value.
   *
   * Because this function may panic, its use is generally discouraged. Instead, prefer to use pattern matching and
   * handle the Err case explicitly, or call unwrapOr or unwrapOrElse.
   *
   * Panics if the value is an Err, with a panic message provided by the Err's value.
   */
  unwrap(): T;

  /**
   * Returns the contained Err value, consuming the self value.
   *
   * Panics if the value is an Ok, with a panic message including the passed message, and the content of the Ok.
   *
   * @param msg
   */
  expectErr(msg: string): E;

  /**
   * Returns the contained Err value, consuming the self value.
   *
   * Panics if the value is an Ok, with a custom panic message provided by the Ok's value.
   */
  unwrapErr(): E;

  /**
   * Execute functions with side-effects.
   */
  tap(val: Partial<IResultPattern<T, E, void>>): void;

  /**
   * Execute a function with side-effects when Result is a Ok
   */
  tapOk(fn: (val: NonNullable<T>) => void): void;

  /**
   * Execute a function with side-effect when Result is a Err
   */
  tapErr(fn: (val: NonNullable<E>) => void): void;
}

export interface Ok<T, E> extends IResult<T, E> {
  tag: "ok";
}

export interface Err<T, E> extends IResult<T, E> {
  tag: "error";
}

/**
 * Result is a type that represents either success (Ok) or failure (Err).
 */
export type Result<T, E> = Ok<T, E> | Err<T, E>;
