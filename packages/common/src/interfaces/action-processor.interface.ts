import { Connection } from "..";

export interface IActionProcessor {
  connection: Connection;
  toRender: boolean;
}
