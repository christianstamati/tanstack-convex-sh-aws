import { devMailboxInternal } from "../models/devMailbox/functions";

// Called as `internal.devMailbox.<function>`, or with `bunx convex run internal/devMailbox:latest`.
export const { latest, list, clear } = devMailboxInternal;
