import { Action, API, behavior, createAction, ok, pipeInto } from "@stellarfw/common/lib/index.js";

/**
 * System action to inform the server status.
 */
export const statusAction: Action<{ status: string }, unknown> = pipeInto(
  createAction("status", "System action to show the server status"),
  behavior(async (_params: unknown, api: API) => ok(api.status)),
);
