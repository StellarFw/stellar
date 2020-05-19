import { Connection } from "../connection";

export interface IActionProcessor {
  connection: Connection;
  toRender: boolean;
}
