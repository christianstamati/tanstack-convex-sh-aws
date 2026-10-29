import { getAuthUserId } from "@convex-dev/auth/server";
import {
  customAction,
  customCtx,
  customMutation,
  customQuery,
} from "convex-helpers/server/customFunctions";
import type { Id } from "../_generated/dataModel";
import { action, mutation, query, type QueryCtx } from "../_generated/server";
import { errors } from "./errors";

/** The signed-in user's id. Throws `not_signed_in` for a caller without a session. */
export async function requireUserId(ctx: Pick<QueryCtx, "auth">): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw errors.create("not_signed_in");
  return userId;
}

const withUserId = customCtx(async (ctx: Pick<QueryCtx, "auth">) => ({
  userId: await requireUserId(ctx),
}));

// Public functions that need a session. They throw `not_signed_in` without one and give the
// handler `ctx.userId`. Define them like `query`, `mutation` and `action`.
export const authQuery = customQuery(query, withUserId);
export const authMutation = customMutation(mutation, withUserId);
export const authAction = customAction(action, withUserId);
