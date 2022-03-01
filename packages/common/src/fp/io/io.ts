import { IO } from "./io.interface.js";

class IOImpl<T> implements IO<T> {
  constructor(private containerFn: () => T) {}

  map<R>(fn: (internalFn: T) => R): IO<R> {
    return io(() => fn(this.containerFn()));
  }

  run(): T {
    return this.containerFn();
  }
}

export function io<T>(fn: () => T): IO<T> {
  return new IOImpl(fn);
}
