/**
 * Sleep for the given amount of time.
 *
 * @param time
 * @returns
 */
export function sleep(time: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, time);
  });
}
