import registerCore from "@convex-dev/auth/test";
import { registerEmail } from "@convex-dev/auth/components/email/test";
import { registerPasswordProvider } from "@convex-dev/auth/components/password/test";
import { convexTest } from "convex-test";
import { afterEach, beforeAll, describe, expect, test, vi } from "vite-plus/test";
import { api, internal } from "../../lib/api.refs";
import { UNVERIFIED_USER_TTL_MS, verifiedUsers } from "../../models/users/functions";
import schema from "../../schema";
import { modules } from "../../test.setup";

// The deployment's variables. `env` from _generated/server is `process.env`.
beforeAll(async () => {
  const { privateKey, publicKey } = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", privateKey));
  const body = btoa(String.fromCharCode(...pkcs8)).replace(/.{64}/g, "$&\n");
  const pem = `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----\n`;
  const jwk = await crypto.subtle.exportKey("jwk", publicKey);
  process.env.AUTH_PRIVATE_KEY = btoa(pem);
  process.env.AUTH_JWKS = JSON.stringify({ keys: [{ ...jwk, kid: "test", use: "sig" }] });
  process.env.SITE_URL = "http://localhost:3000";
  process.env.CONVEX_SITE_URL = "http://127.0.0.1:3211";
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function setup() {
  vi.useFakeTimers();
  const t = convexTest(schema, modules);
  registerCore.registerCore(t);
  registerEmail(t);
  registerPasswordProvider(t);
  // Without RESEND_API_KEY, `logEmail` logs each email and stores it in devMailbox.
  vi.spyOn(console, "log").mockImplementation(() => {});
  const users = () => t.run((ctx) => ctx.db.query("users").take(10));
  // The email component rate-limits sign-ups by the client's IP.
  const browser = t.withRequestMetadata({ ip: "127.0.0.1" });

  /** Signs up, and verifies the email when asked: what opening the emailed link does. */
  async function signUp(email: string, { verify }: { verify: boolean }) {
    const result = await browser.mutation(api.auth.signUpWithEmailPassword, {
      email,
      password: "correct horse battery staple",
    });
    if (!result.success) throw new Error(result.userError.error);
    const mail = await t.query(internal.devMailbox.latest, { to: email });
    expect(mail?.code).toBeTruthy();
    if (verify) {
      const complete = await browser.mutation(api.auth.completeSignUp, {
        emailCode: mail!.code!,
        browserSecret: result.browserSecret,
      });
      expect(complete.status).toBe("complete");
    }
  }

  /** Runs what's due once the clock moves forward. */
  async function advance(ms: number) {
    vi.advanceTimersByTime(ms);
    await t.finishInProgressScheduledFunctions();
  }

  const signIn = (email: string) =>
    browser.mutation(api.auth.signInWithEmailPassword, {
      email,
      password: "correct horse battery staple",
    });

  return { t, users, signUp, signIn, advance };
}

describe("unverified users", () => {
  test("are removed a day after sign-up; verified ones stay", async () => {
    const { users, signUp, signIn, advance } = setup();
    await signUp("verified@example.com", { verify: true });
    await signUp("unverified@example.com", { verify: false });
    expect(await users()).toHaveLength(2);

    await advance(UNVERIFIED_USER_TTL_MS - 1000);
    expect(await users()).toHaveLength(2);

    await advance(2000);
    expect(await users()).toHaveLength(1);
    // The one left is the verified user, who can still sign in.
    expect((await signIn("verified@example.com")).status).toBe("complete");
  });

  test("the sweep removes old users without a verified email", async () => {
    const { t, users, signUp, advance } = setup();
    await signUp("verified@example.com", { verify: true });
    // A user from before `createUser` scheduled the check, and one created just now.
    const old = await t.run((ctx) => ctx.db.insert("users", {}));
    await advance(UNVERIFIED_USER_TTL_MS + 1000);
    const recent = await t.run((ctx) => ctx.db.insert("users", {}));

    expect(await t.mutation(internal.users.removeUnverifiedUsers, {})).toEqual({
      removed: 1,
      more: false,
    });
    const ids = (await users()).map((user) => user._id);
    expect(ids).not.toContain(old);
    expect(ids).toContain(recent);
    expect(ids).toHaveLength(2);
  });

  test("includeRecent removes new unverified users too, and keeps verified ones", async () => {
    const { t, users, signUp, signIn } = setup();
    await signUp("verified@example.com", { verify: true });
    await signUp("unverified@example.com", { verify: false });

    expect(await t.mutation(internal.users.removeUnverifiedUsers, {})).toEqual({
      removed: 0,
      more: false,
    });
    expect(await t.mutation(internal.users.removeUnverifiedUsers, { includeRecent: true })).toEqual(
      { removed: 1, more: false },
    );
    expect(await users()).toHaveLength(1);
    expect((await signIn("verified@example.com")).status).toBe("complete");
  });
});

describe("verifiedAt", () => {
  test("is set when the email is verified, and kept by later sign-ins", async () => {
    const { users, signUp, signIn, advance } = setup();
    await signUp("unverified@example.com", { verify: false });
    expect((await users())[0]!.verifiedAt).toBeUndefined();

    const before = Date.now();
    await signUp("verified@example.com", { verify: true });
    const verifiedAt = (await users())[1]!.verifiedAt;
    expect(verifiedAt).toBeGreaterThanOrEqual(before);

    await advance(60_000);
    expect((await signIn("verified@example.com")).status).toBe("complete");
    expect((await users())[1]!.verifiedAt).toBe(verifiedAt);
  });

  test("verifiedUsers lists only Users, not Unverified users", async () => {
    const { t, signUp } = setup();
    await signUp("first@example.com", { verify: true });
    await signUp("unverified@example.com", { verify: false });
    await signUp("second@example.com", { verify: true });

    const listed = await t.run((ctx) => verifiedUsers(ctx).take(10));
    expect(listed).toHaveLength(2);
    expect(listed.every((user) => user.verifiedAt !== undefined)).toBe(true);
  });

  test("the backfill sets it on users verified before onSignIn did", async () => {
    const { t, users, signUp } = setup();
    await signUp("old@example.com", { verify: true });
    await signUp("unverified@example.com", { verify: false });
    // As if the User had verified before `onSignIn` set the field.
    const [old] = await users();
    await t.run((ctx) => ctx.db.patch("users", old!._id, { verifiedAt: undefined }));

    expect(await t.mutation(internal.users.backfillVerifiedAt, {})).toEqual({
      updated: 1,
      more: false,
    });
    const [backfilled, unverified] = await users();
    expect(backfilled!.verifiedAt).toBe(old!._creationTime);
    expect(unverified!.verifiedAt).toBeUndefined();
  });
});
