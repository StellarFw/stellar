import { Connection } from "../connection.js";

export interface IActionProcessor {
  connection: Connection;
  toRender: boolean;
}
