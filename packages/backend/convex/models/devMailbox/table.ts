import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * The auth emails of a deployment without RESEND_API_KEY, which logs them instead of sending
 * them. A test session reads the links and codes from here with `internal/devMailbox:latest`. A
 * deployment that sends through Resend stores nothing here.
 */
export const devMailboxTable = defineTable({
  /** The recipient, lowercased. */
  to: v.string(),
  subject: v.string(),
  text: v.string(),
  /** The first link in the email, such as the verification or password reset page. */
  link: v.union(v.string(), v.null()),
  /** The link's `code` param, which the verification and reset pages take. */
  code: v.union(v.string(), v.null()),
}).index("by_to", ["to"]);
