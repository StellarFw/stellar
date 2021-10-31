import { unsafe } from "..";
import { Result } from "../result";
import { IO } from "./io.interface";

class IOImpl<T> implements IO<T> {
  constructor(private containerFn: () => T) {}

  map<R>(fn: (internalFn: T) => R): IO<R> {
    return io(() => fn(this.containerFn()));
  }

  run(): Result<T, string> {
    return unsafe(this.containerFn);
  }
}

export function io<T>(fn: () => T): IO<T> {
  return new IOImpl(fn);
}
