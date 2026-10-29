import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { query } from "../../_generated/server";
import { authMutation } from "../../lib/auth";
import { errors } from "../../lib/errors";
import { enforceRateLimit } from "../../lib/rateLimits";
import schema from "../../schema";

const MIN_LENGTH = 1;
const MAX_LENGTH = 500;

const list = query({
  args: {},
  returns: v.array(schema.doc("notes")),
  handler: async (ctx) => {
    // Not an authQuery: empty without a session instead of an error, because the page's loader
    // runs before its gate on a navigation in the browser, and the gate then sends that visitor
    // to sign in.
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    return await ctx.db
      .query("notes")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .order("desc")
      .take(100);
  },
});

const create = authMutation({
  args: { text: v.string() },
  returns: v.id("notes"),
  handler: async (ctx, { text }) => {
    const { userId } = ctx;
    const trimmed = text.trim();
    if (trimmed.length < MIN_LENGTH || trimmed.length > MAX_LENGTH) {
      throw errors.create("invalid_length", { what: "note", min: MIN_LENGTH, max: MAX_LENGTH });
    }
    await enforceRateLimit(ctx, "createNote", userId);
    return await ctx.db.insert("notes", { userId, text: trimmed });
  },
});

const remove = authMutation({
  args: { id: v.id("notes") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const note = await ctx.db.get("notes", id);
    // Someone else's note gets the same answer as a deleted one.
    if (note === null || note.userId !== ctx.userId)
      throw errors.create("not_found", { what: "note" });
    await ctx.db.delete("notes", id);
    return null;
  },
});

export const notesApi = { list, create, remove };
