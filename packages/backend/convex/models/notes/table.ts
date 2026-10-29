import { defineTable } from "convex/server";
import { v } from "convex/values";

/** Example feature: a note. Each user sees and edits only their own. */
export const notesTable = defineTable({
  userId: v.id("users"),
  text: v.string(),
}).index("by_userId", ["userId"]);
