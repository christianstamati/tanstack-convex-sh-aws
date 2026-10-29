import { MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import type { ActionCtx, MutationCtx } from "../_generated/server";
import { components } from "./api.refs";
import { errors } from "./errors";

/**
 * Every app-level rate limit, by name. A token bucket allows `capacity` calls at once, then
 * refills at `rate` per `period`. See https://www.convex.dev/components/rate-limiter.
 */
const limits = {
  // Example feature: delete with convex/models/notes.
  createNote: { kind: "token bucket", rate: 30, period: MINUTE, capacity: 10 },
} as const;

export const rateLimiter = new RateLimiter(components.rateLimiter, limits);

/**
 * Uses one call of the `name` limit for `key`, such as `ctx.userId`. Throws `rate_limited`
 * when the limit is reached. Call it in a mutation or action before doing the work: a mutation
 * that throws later rolls the call back too.
 */
export async function enforceRateLimit(
  ctx: MutationCtx | ActionCtx,
  name: keyof typeof limits,
  key: string,
): Promise<void> {
  const { ok, retryAfter } = await rateLimiter.limit(ctx, name, { key });
  if (!ok) {
    throw errors.create("rate_limited", { retryAfterSeconds: Math.ceil(retryAfter / 1000) });
  }
}
