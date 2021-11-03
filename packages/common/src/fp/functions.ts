/**
 * Returns a function that always returns the same value.
 */
export function always<T>(x: T): () => T {
  return () => x;
}
