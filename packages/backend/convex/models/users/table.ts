import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * One document for each User, and for each Unverified user until they verify or are deleted.
 * Its `_id` is the user id of Convex Auth's tokens. The auth components keep the email, the
 * password hash and the Sessions; this table keeps the profile.
 */
export const usersTable = defineTable({
  /** The name to show, set on /settings. Unset until the user picks one. */
  name: v.optional(v.string()),
  /**
   * When the email was verified, set by the first sign-in. Unset for an Unverified user, so
   * `verifiedUsers` lists Users through the index without asking the authEmail component.
   */
  verifiedAt: v.optional(v.number()),
}).index("by_verifiedAt", ["verifiedAt"]);
