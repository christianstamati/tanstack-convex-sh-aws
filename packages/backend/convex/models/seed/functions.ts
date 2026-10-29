import { v } from "convex/values";
import { api, components, internal } from "../../lib/api.refs";
import type { Id } from "../../_generated/dataModel";
import { env, internalMutation } from "../../_generated/server";

/** The seeded user's password. The seed refuses to run anywhere but a local web app. */
export const SEED_PASSWORD = "Test!12345";

/** The users the seed creates, each with a verified email, so they can sign in right away. */
export const SEED_USERS = [
  {
    email: "ada@example.com",
    name: "Ada",
    // Example feature: drop `notes` here and below when removing the notes list.
    notes: ["Try the Notes page", "Delete this note"],
  },
];

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]"];

/**
 * Creates SEED_USERS on the dev deployment, with their names and notes. A user whose email
 * already has an account is left as it is, so running it again is safe. From the repo root:
 *
 *   bun run convex:seed
 *
 * It signs each user up through `api.auth`, as the sign-up page does, and opens the emailed
 * link itself, so it needs the devMailbox: it refuses while RESEND_API_KEY is set.
 */
const run = internalMutation({
  args: {},
  returns: v.object({ created: v.array(v.string()), existing: v.array(v.string()) }),
  handler: async (ctx): Promise<{ created: string[]; existing: string[] }> => {
    // Known passwords on a deployment that others can reach would let anyone in.
    if (!LOCAL_HOSTS.includes(new URL(env.SITE_URL).hostname)) {
      throw new Error(`The seed only runs for a local web app, and SITE_URL is ${env.SITE_URL}.`);
    }
    if (env.RESEND_API_KEY) {
      throw new Error("The seed reads the sign-up emails from devMailbox: unset RESEND_API_KEY.");
    }

    const created: string[] = [];
    const existing: string[] = [];
    for (const { email, name, notes } of SEED_USERS) {
      const signUp = await ctx.runMutation(api.auth.signUpWithEmailPassword, {
        email,
        password: SEED_PASSWORD,
      });
      if (!signUp.success) {
        if (signUp.userError.error === "EMAIL_TAKEN") {
          existing.push(email);
          continue;
        }
        throw new Error(`Couldn't sign up ${email}: ${signUp.userError.error}`);
      }

      // Without RESEND_API_KEY, `logEmail` stored the verification email in devMailbox.
      const mail = await ctx.runQuery(internal.devMailbox.latest, { to: email });
      if (mail?.code == null) throw new Error(`No verification email for ${email} in devMailbox.`);
      const verified = await ctx.runMutation(api.auth.completeSignUp, {
        emailCode: mail.code,
        browserSecret: signUp.browserSecret,
      });
      if (verified.status !== "complete") {
        throw new Error(`Couldn't verify ${email}: ${verified.userError.error}`);
      }
      await ctx.db.delete("devMailbox", mail._id);

      const lookup = await ctx.runMutation(components.authEmail.verifiedEmails.lookupEmail, {
        email,
      });
      if (!lookup.success) throw new Error(`Couldn't find ${email}: ${lookup.userError.error}`);
      const userId = lookup.userId as Id<"users">;
      await ctx.db.patch("users", userId, { name });
      for (const text of notes) await ctx.db.insert("notes", { userId, text });
      created.push(email);
    }
    console.log(
      `Seeded ${created.length} users, ${existing.length} already there. Password: ${SEED_PASSWORD}`,
    );
    return { created, existing };
  },
});

export const seedInternal = { run };
