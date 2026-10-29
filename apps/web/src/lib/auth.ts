import { convexQuery } from "@convex-dev/react-query";
import { api } from "#/lib/api";

// Messages for the error codes of Convex Auth's email and password hooks. They come back in the
// hooks' results, not as thrown errors, so they don't go through convex/lib/errors.ts.
const MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: "Wrong email or password.",
  USER_NOT_FOUND: "Wrong email or password.",
  EMAIL_TAKEN: "An account already uses that email.",
  INVALID_EMAIL: "Enter a valid email address.",
  PASSWORD_TOO_SHORT: "That password is too short.",
  PASSWORD_TOO_LONG: "That password is too long.",
  PASSWORD_TOO_COMMON: "That password is too common. Choose another one.",
  PASSWORD_HAS_SURROUNDING_WHITESPACE: "A password can't start or end with a space.",
  RATE_LIMITED: "Too many attempts. Wait a minute and try again.",
  INVALID_CHALLENGE: "This link has expired or was already used. Request a new one.",
  INCORRECT_CODE: "This link has expired or was already used. Request a new one.",
  // The hook removes the browser's secret once the link works, so an already used link and a
  // link opened in another browser look the same here.
  MISSING_SECRET:
    "This link was already used, or it was opened in a different browser from the one that asked for it.",
};

/** A message for a hook's `userError`. */
export function authErrorMessage(userError: { error: string }): string {
  return MESSAGES[userError.error] ?? "Something went wrong. Try again.";
}

/** The signed-in user, or `null`. The root route loads it for a page rendered as the user. */
export const meQuery = convexQuery(api.users.me);

/** Where to go after signing in. */
export const AFTER_SIGN_IN = "/notes";

/**
 * The `next` search param of the sign-in page: a path on this site to return to. Anything else,
 * such as `//evil.example` or `/\evil.example`, is dropped, so the page can't send anyone to
 * another site.
 */
export function validateNext(search: Record<string, unknown>): { next?: string } {
  const { next } = search;
  return typeof next === "string" && /^\/(?![/\\])/.test(next) ? { next } : {};
}
