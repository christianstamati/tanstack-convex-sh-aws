import { createAttempt } from "@cs-stack/convex-errors";
import { errors } from "@workspace/backend/convex/lib/errors";
import { toast } from "sonner";

/** The app's error codes, from convex/lib/errors.ts. Use `errors.is` to handle one error differently. */
export { errors };

/**
 * Runs a mutation or action and shows a toast if it fails: the error's own message, or
 * `fallback` for anything else. Resolves to whether it succeeded and never rejects, so
 * don't wrap it in try/catch.
 */
export const attempt = createAttempt(errors, { onError: (message) => toast.error(message) });
