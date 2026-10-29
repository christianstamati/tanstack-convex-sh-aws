import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { components, internal } from "../../lib/api.refs";
import type { Id } from "../../_generated/dataModel";
import { internalMutation, query, type MutationCtx, type QueryCtx } from "../../_generated/server";
import { authMutation } from "../../lib/auth";
import { errors } from "../../lib/errors";

const MAX_NAME_LENGTH = 60;

/**
 * How long a user may stay without a verified email. The sign-up link works for an hour and
 * can't be sent again, so after that the user can never sign in; the rest is margin.
 */
export const UNVERIFIED_USER_TTL_MS = 24 * 60 * 60 * 1000;

/** The provider Convex Auth passes to `createUser` and `onSignIn`. */
const vProvider = v.object({
  name: v.literal("emailPassword"),
  accountId: v.string(),
  profile: v.object({}),
});

/**
 * The Users: every user with a verified email, oldest verification first. Use it wherever the
 * app counts or lists Users, so Unverified users never show up. Unset fields sort before every
 * number, so the range skips them.
 */
export function verifiedUsers(ctx: QueryCtx) {
  return ctx.db.query("users").withIndex("by_verifiedAt", (q) => q.gte("verifiedAt", 0));
}

/**
 * Convex Auth calls this when someone signs up, before their email is verified: it creates an
 * Unverified user.
 */
const createUser = internalMutation({
  args: { provider: vProvider },
  returns: v.id("users"),
  handler: async (ctx): Promise<Id<"users">> => {
    const userId = await ctx.db.insert("users", {});
    await ctx.scheduler.runAfter(UNVERIFIED_USER_TTL_MS, internal.users.removeUnverifiedUser, {
      userId,
    });
    return userId;
  },
});

/**
 * Convex Auth calls this on every sign-in. The first one happens only in `completeSignUp`, in
 * the transaction that verifies the email, and every later one needs a verified email, so the
 * first sign-in is when the Unverified user becomes a User.
 */
const onSignIn = internalMutation({
  args: { provider: vProvider, userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get("users", userId);
    if (user !== null && user.verifiedAt === undefined) {
      await ctx.db.patch("users", userId, { verifiedAt: Date.now() });
    }
    return null;
  },
});

/**
 * Deletes a user who never verified their email, with their pending email challenges. Returns
 * whether it did. A user with a verified email is left alone.
 */
async function removeIfUnverified(ctx: MutationCtx, userId: Id<"users">): Promise<boolean> {
  const user = await ctx.db.get("users", userId);
  if (user === null || user.verifiedAt !== undefined) return false;
  // Users verified before `onSignIn` set `verifiedAt` have only the verified email to show for it.
  const emails = await ctx.runQuery(components.authEmail.verifiedEmails.getEmails, { userId });
  if (emails.length > 0) return false;
  await ctx.runMutation(components.authEmail.verifiedEmails.deleteUser, { userId });
  // Convex Auth 2.0.0-beta.0 can't delete the user's account and password hash yet, so those
  // stay. Nothing reaches them: sign-in finds a user only through a verified email.
  await ctx.db.delete("users", userId);
  return true;
}

/** Scheduled by `createUser` for UNVERIFIED_USER_TTL_MS after sign-up. */
const removeUnverifiedUser = internalMutation({
  args: { userId: v.id("users") },
  returns: v.boolean(),
  handler: async (ctx, { userId }): Promise<boolean> => {
    return await removeIfUnverified(ctx, userId);
  },
});

/**
 * Deletes every user older than UNVERIFIED_USER_TTL_MS without a verified email, 100 at a time,
 * for users created before `createUser` scheduled the check. Run it from packages/backend:
 *
 *   bunx convex run internal/users:removeUnverifiedUsers
 *   bunx convex run internal/users:removeUnverifiedUsers "{includeRecent: true}"
 *
 * `includeRecent` skips the age check, so it also deletes someone who signed up a minute ago and
 * hasn't opened the link yet. Users with a verified email always stay. Returns how many users
 * this batch removed, and whether more batches were scheduled.
 */
const removeUnverifiedUsers = internalMutation({
  args: {
    includeRecent: v.optional(v.boolean()),
    before: v.optional(v.number()),
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.object({ removed: v.number(), more: v.boolean() }),
  handler: async (ctx, args): Promise<{ removed: number; more: boolean }> => {
    // No cutoff at all with `includeRecent`, so a user created this instant counts too.
    const before = args.includeRecent
      ? undefined
      : (args.before ?? Date.now() - UNVERIFIED_USER_TTL_MS);
    const page = await ctx.db
      .query("users")
      .withIndex("by_creation_time", (q) =>
        before === undefined ? q : q.lt("_creationTime", before),
      )
      .paginate({ numItems: 100, cursor: args.cursor ?? null });
    let removed = 0;
    for (const user of page.page) {
      if (await removeIfUnverified(ctx, user._id)) removed++;
    }
    console.log(`Removed ${removed} unverified users${page.isDone ? "." : ", checking more."}`);
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.users.removeUnverifiedUsers, {
        includeRecent: args.includeRecent,
        before,
        cursor: page.continueCursor,
      });
    }
    return { removed, more: !page.isDone };
  },
});

/**
 * Sets `verifiedAt` on users who verified their email before `onSignIn` set it, 100 at a time.
 * Run it once on a deployment that has such users, from packages/backend:
 *
 *   bunx convex run internal/users:backfillVerifiedAt
 *
 * The authEmail component doesn't record when an email was verified, so it uses the time of
 * sign-up: the sign-up link works for an hour. Unverified users stay as they are. Returns how
 * many users this batch updated, and whether more batches were scheduled.
 */
const backfillVerifiedAt = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  returns: v.object({ updated: v.number(), more: v.boolean() }),
  handler: async (ctx, args): Promise<{ updated: number; more: boolean }> => {
    const page = await ctx.db
      .query("users")
      .withIndex("by_verifiedAt", (q) => q.eq("verifiedAt", undefined))
      .paginate({ numItems: 100, cursor: args.cursor ?? null });
    let updated = 0;
    for (const user of page.page) {
      const emails = await ctx.runQuery(components.authEmail.verifiedEmails.getEmails, {
        userId: user._id,
      });
      if (emails.length === 0) continue;
      await ctx.db.patch("users", user._id, { verifiedAt: user._creationTime });
      updated++;
    }
    console.log(`Set verifiedAt on ${updated} users${page.isDone ? "." : ", checking more."}`);
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.users.backfillVerifiedAt, {
        cursor: page.continueCursor,
      });
    }
    return { updated, more: !page.isDone };
  },
});

/** The signed-in user, or `null` without a session. */
const me = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      id: v.id("users"),
      email: v.union(v.string(), v.null()),
      name: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const user = await ctx.db.get("users", userId);
    if (user === null) return null;
    const email = await ctx.runQuery(components.authEmail.verifiedEmails.getPrimaryEmail, {
      userId,
    });
    return { id: userId, email, name: user.name ?? null };
  },
});

/** Sets the signed-in user's name. An empty name removes it. */
const setName = authMutation({
  args: { name: v.string() },
  returns: v.null(),
  handler: async (ctx, { name }) => {
    const trimmed = name.trim();
    if (trimmed.length > MAX_NAME_LENGTH) {
      throw errors.create("invalid_length", { what: "name", min: 0, max: MAX_NAME_LENGTH });
    }
    await ctx.db.patch("users", ctx.userId, { name: trimmed === "" ? undefined : trimmed });
    return null;
  },
});

export const usersApi = { me, setName };
export const usersInternal = {
  createUser,
  onSignIn,
  removeUnverifiedUser,
  removeUnverifiedUsers,
  backfillVerifiedAt,
};
