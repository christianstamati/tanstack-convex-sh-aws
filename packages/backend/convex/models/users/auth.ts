import { setupEmailPassword } from "@convex-dev/auth/methods/email-password/server";
import { setupConvexAuth } from "@convex-dev/auth/server";
import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { components, internal } from "../../lib/api.refs";
import { env, internalMutation } from "../../_generated/server";
import { storeEmail } from "../devMailbox/functions";

const core = setupConvexAuth({ component: components.auth });
const { signOut, refreshSession } = core;

/**
 * Stands in for Resend's `sendEmail` while RESEND_API_KEY is unset, as on a new local deployment:
 * the email, with its link, goes to the Convex logs, which `bun run dev` prints, and to the
 * devMailbox table, where `internal/devMailbox:latest` finds it.
 */
const logEmail = internalMutation({
  args: {
    options: v.any(),
    from: v.string(),
    to: v.array(v.string()),
    subject: v.optional(v.string()),
    text: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { to, subject, text }) => {
    // One line per message: Convex prints a logged string quoted, with newlines as `\n`. The
    // link is followed by a space, so the terminal sees where it ends and can open it.
    console.log(`Email not sent (no RESEND_API_KEY) to ${to.join(", ")}: ${subject}`);
    const link = text?.match(/https?:\/\/\S+/)?.[0];
    if (link) console.log(`Open ${link} in the browser that asked for it.`);
    await storeEmail(ctx, { to, subject: subject ?? "", text: text ?? "" });
    return null;
  },
});

const sendEmail = components.resend.lib.sendEmail;
// It takes the same arguments as `sendEmail`; only the return value, which no caller reads,
// differs. A reference by name, because `internal`'s type includes this file's functions.
const logEmailRef = makeFunctionReference<"mutation">(
  "internal/users:logEmail",
) as unknown as typeof sendEmail;

// Email and password, with email verification at sign-up and password recovery by email link.
// Sign-up creates an Unverified user right away. Opening the link verifies the email and starts
// the first Session, and `onSignIn` then marks the User verified.
const {
  signUpWithEmailPassword,
  completeSignUp,
  signInWithEmailPassword,
  startPasswordRecovery,
  checkPasswordRecovery,
  completePasswordRecovery,
} = setupEmailPassword(core, {
  component: components.authEmail,
  passwordComponent: components.authPassword,
  emailSender: {
    kind: "resend",
    sendEmail: env.RESEND_API_KEY ? sendEmail : logEmailRef,
    apiKey: env.RESEND_API_KEY ?? "",
    from: env.AUTH_EMAIL_FROM ?? "onboarding@resend.dev",
  },
  // The emailed links append `?code=…` to these pages of apps/web.
  urls: {
    signUp: `${env.SITE_URL}/verify-email`,
    recovery: `${env.SITE_URL}/reset-password`,
    // Unused until the app exports startChangeEmail and completeChangeEmail and adds this page.
    changeEmail: `${env.SITE_URL}/confirm-email-change`,
  },
}).attachUserCallbacks({
  createUser: internal.users.createUser,
  onSignIn: internal.users.onSignIn,
});

export const authApi = {
  signOut,
  refreshSession,
  signUpWithEmailPassword,
  completeSignUp,
  signInWithEmailPassword,
  startPasswordRecovery,
  checkPasswordRecovery,
  completePasswordRecovery,
};
export const authInternal = { logEmail };
