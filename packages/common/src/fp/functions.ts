/**
 * Returns the value it was given.
 */
export function identity<T>(x: T): T {
	return x;
}

/**
 * Returns a function that always returns the same value.
 */
export function always<T>(x: T): () => T {
	return () => x;
}

/**
 * Returns a function that always returns the same promised value.
 */
export function asyncAlways<T>(x: T): () => Promise<T> {
	const promisedVal = promisify(x);
	return () => promisedVal;
}

/**
 * Wrap the given value into a promise that always resolves to the same value.
 */
export async function promisify<T>(value: T): Promise<T> {
	return value;
}

/**
 * Generate a new function that pipes the given value into each function given.
 *
 * FIXME: this must be converted into type safe code once TypeScript has support for this type of operations.
 */
// eslint-disable-next-line @typescript-eslint/ban-types
export function pipe<T, O>(...fns: Array<Function>) {
	return (value: T) => fns.reduce((a, fn) => fn(a), value) as unknown as O;
}

/**
 * Automatically executes a pipeline with the first parameter as argument.
 */
// eslint-disable-next-line @typescript-eslint/ban-types
export function pipeInto<T, O>(val: T, fn1: Function, ...fns: Array<Function>) {
	return pipe<T, O>(fn1, ...fns)(val);
}

type MapPromiseParam<T, R> = (val: T) => R;
type MapPromiseReturn<T, R> = (val: Promise<T>) => Promise<R>;
export function mapPromise<T, R>(mapFn: MapPromiseParam<T, R>): MapPromiseReturn<T, R> {
	return (wrapperVal: Promise<T>) => wrapperVal.then(mapFn);
}
