import { seedInternal } from "../models/seed/functions";

// Called as `internal.seed.run`, or with `bun run convex:seed` from the repo root.
export const { run } = seedInternal;
