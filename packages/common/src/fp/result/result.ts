import { none, panic, some } from "../index";
import { Option } from "../option/option.interface";
import { Err as IErr, IResultPattern, Ok as IOk, Result } from "./result.interface";

class Ok<T, E> implements IOk<T, E> {
	public readonly tag: "ok" = "ok";

	/**
	 * Create a new Ok instance.
	 *
	 * @param value
	 */
	public constructor(private readonly value: T) {}

	unwrapErr(): E {
		panic(`panics with \`${JSON.stringify(this.value)}\``);
	}

	expectErr(msg: string): E {
		panic(`panics with \`${msg}: ${this.value}\``);
	}

	unwrap(): T {
		return this.value;
	}

	expect(): T {
		return this.value;
	}

	unwrapOr(): T {
		return this.value;
	}

	unwrapOrElse(): T {
		return this.value;
	}

	or<F>(): Result<T, F> {
		return ok(this.value);
	}

	orElse<F>(): Result<T, F> {
		return ok(this.value);
	}

	and<U>(res: Result<U, E>): Result<U, E> {
		return res;
	}

	andThen<U>(op: (val: T) => Result<U, E>): Result<U, E> {
		return op(this.value);
	}

	mapErr<F>(): Result<T, F> {
		return ok<T, F>(this.value);
	}

	mapOrElse<U>(_: (val: E) => U, f: (val: T) => U): U {
		return f(this.value);
	}

	mapOr<U>(_: U, f: (val: T) => U): U {
		return f(this.value);
	}

	map<U>(f: (val: T) => U): Result<U, E> {
		return ok<U, E>(f(this.value));
	}

	err(): Option<E> {
		return none<E>();
	}

	ok(): Option<T> {
		return some(this.value as NonNullable<T>);
	}

	containsErr(): boolean {
		return false;
	}

	contains(x: T): boolean {
		// TODO: implement complex equality logic
		return this.value === x;
	}

	isErr(): boolean {
		return false;
	}

	isOk(): boolean {
		return true;
	}

	tap(val: Partial<IResultPattern<T, E, void>>): void {
		val.ok && val.ok(this.value as NonNullable<T>);
	}

	tapOk(fn: (val: NonNullable<T>) => void): void {
		fn(this.value as NonNullable<T>);
	}

	tapErr(): void {
		// don't do nothing when is an Ok value
	}

	match<R>(pattern: IResultPattern<T, E, R>): R {
		return pattern.ok(this.value as NonNullable<T>);
	}
}

class Err<T, E> implements IErr<T, E> {
	public readonly tag: "error" = "error";

	/**
	 * Create a new Err instance.
	 *
	 * @param value
	 */
	public constructor(private readonly value: E) {}

	unwrapErr(): E {
		return this.value;
	}

	expectErr(): E {
		return this.value;
	}

	unwrap(): T {
		panic(`panics with \`${this.value}\``);
	}

	expect(msg: string): T {
		panic(`panics with \`${msg}: ${this.value}\``);
	}

	unwrapOr(defaultVal: T): T {
		return defaultVal;
	}

	unwrapOrElse(op: (val: E) => T): T {
		return op(this.value);
	}

	or<F>(res: Result<T, F>): Result<T, F> {
		return res;
	}

	orElse<F>(op: (val: E) => Result<T, F>): Result<T, F> {
		return op(this.value);
	}

	and<U>(): Result<U, E> {
		return err(this.value);
	}

	andThen<U>(): Result<U, E> {
		return err(this.value);
	}

	mapErr<F>(op: (val: E) => F): Result<T, F> {
		return err(op(this.value));
	}

	mapOrElse<U>(defaultF: (val: E) => U): U {
		return defaultF(this.value);
	}

	mapOr<U>(defaultVal: U): U {
		return defaultVal;
	}

	map<U>(): Result<U, E> {
		return err<U, E>(this.value);
	}

	err(): Option<E> {
		return some<E>(this.value as NonNullable<E>);
	}

	ok(): Option<T> {
		return none<T>();
	}

	containsErr(f: E): boolean {
		// TODO: implement complex equality logic
		return this.value === f;
	}

	contains(): boolean {
		return false;
	}

	isErr(): boolean {
		return true;
	}

	isOk(): boolean {
		return false;
	}

	tap(val: Partial<IResultPattern<T, E, void>>): void {
		val.err && val.err(this.value as NonNullable<E>);
	}

	tapOk(): void {
		// Does nothing when is a Err value
	}

	tapErr(fn: (val: NonNullable<E>) => void): void {
		fn(this.value as NonNullable<E>);
	}

	match<R>(pattern: IResultPattern<T, E, R>): R {
		return pattern.err(this.value as NonNullable<E>);
	}
}

/**
 * Create a new Ok value.
 *
 * @param value
 */
export function ok<T, E>(value: T): Result<T, E> {
	return new Ok(value);
}

/**
 * Create a new Err value.
 *
 * @param value
 */
export function err<T, E>(value: E): Result<T, E> {
	return new Err(value);
}
