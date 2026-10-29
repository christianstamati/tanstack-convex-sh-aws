import registerCore from "@convex-dev/auth/test";
import { registerEmail } from "@convex-dev/auth/components/email/test";
import { registerPasswordProvider } from "@convex-dev/auth/components/password/test";
import { convexTest } from "convex-test";
import { afterEach, beforeAll, describe, expect, test, vi } from "vite-plus/test";
import { api, internal } from "../../lib/api.refs";
import { SEED_PASSWORD, SEED_USERS } from "../../models/seed/functions";
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
  process.env.CONVEX_SITE_URL = "http://127.0.0.1:3211";
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.RESEND_API_KEY;
});

function setup(siteUrl = "http://localhost:3000") {
  process.env.SITE_URL = siteUrl;
  const t = convexTest(schema, modules);
  registerCore.registerCore(t);
  registerEmail(t);
  registerPasswordProvider(t);
  vi.spyOn(console, "log").mockImplementation(() => {});
  // The email component rate-limits sign-ups by the client's IP, as `convex run` sends it.
  const cli = t.withRequestMetadata({ ip: "127.0.0.1" });
  const seed = () => cli.mutation(internal.seed.run, {});
  return { t, cli, seed };
}

describe("seed", () => {
  test("creates verified users who can sign in, with their names and notes", async () => {
    const { t, cli, seed } = setup();
    const emails = SEED_USERS.map((user) => user.email);
    expect(await seed()).toEqual({ created: emails, existing: [] });

    for (const { email } of SEED_USERS) {
      const signIn = await cli.mutation(api.auth.signInWithEmailPassword, {
        email,
        password: SEED_PASSWORD,
      });
      expect(signIn.status).toBe("complete");
    }
    const users = await t.run((ctx) => ctx.db.query("users").take(10));
    expect(new Set(users.map((user) => user.name))).toEqual(
      new Set(SEED_USERS.map((user) => user.name)),
    );
    expect(users.every((user) => user.verifiedAt !== undefined)).toBe(true);
    const notes = await t.run((ctx) => ctx.db.query("notes").take(10));
    expect(notes).toHaveLength(SEED_USERS.flatMap((user) => user.notes).length);
    // The verification emails it opened are gone.
    expect(await t.query(internal.devMailbox.list, {})).toEqual([]);
  });

  test("leaves existing users alone when run again", async () => {
    const { t, seed } = setup();
    await seed();
    expect(await seed()).toEqual({
      created: [],
      existing: SEED_USERS.map((user) => user.email),
    });
    expect(await t.run((ctx) => ctx.db.query("users").take(10))).toHaveLength(SEED_USERS.length);
  });

  test("refuses a web app that isn't local", async () => {
    const { t, seed } = setup("https://app.example.com");
    await expect(seed()).rejects.toThrow("only runs for a local web app");
    expect(await t.run((ctx) => ctx.db.query("users").take(10))).toEqual([]);
  });

  test("refuses while emails go through Resend", async () => {
    const { seed } = setup();
    process.env.RESEND_API_KEY = "re_test";
    await expect(seed()).rejects.toThrow("unset RESEND_API_KEY");
  });
});
