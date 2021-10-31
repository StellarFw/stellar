import { err, ok, Result } from ".";

/**
 * Panic with an error.
 *
 * The use of this functions isn't recommenced since this can lead to the program to die. Instead it's recommended to
 * use a Result monad to return an error.
 */
export function panic(error: string | Error): never {
  throw error instanceof Error ? error : Error(error);
}

/**
 * Contains an unsafe operation inside a secure container.
 *
 * This always returns a Result type with the function return type and a string representation of the error.
 *
 * @param f
 */
export function unsafe<T>(f: () => T): Result<T, string> {
  try {
    const result = f();
    return ok(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : error;
    return err(msg);
  }
}

/**
 * Contains an unsafe async operation inside a secure container.
 *
 * This always returns a Result type with the function return type and a string representation of the error.
 *
 * @param f
 */
export async function unsafeAsync<T>(
  f: () => Promise<T>
): Promise<Result<T, string>> {
  try {
    const result = await f();
    return ok(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : error;
    return err(msg);
  }
}
