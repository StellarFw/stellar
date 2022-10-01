/**
 * IO represents a call to IO.
 *
 * TO archive a more pure functional approach and, also, this way forcing the developer to handle errors correctly.
 */
export interface IO<T> {
	/**
	 * Create a new IO based on the original creating a new IO.
	 *
	 * This means even after applying this function there is no execution of the monad, so that means the code still pure.
	 *
	 * @param fn function to be executed to the return of the original IO
	 */
	map<R>(fn: (internalFn: T) => R): IO<R>;

	/**
	 * Execute the function.
	 *
	 * From this point there code becomes impure. This doesn't mean runtime errors are catch while executing the IO
	 * container. If your code isn't secure wrap it around with the `unsafe` function.
	 */
	run(): T;
}
