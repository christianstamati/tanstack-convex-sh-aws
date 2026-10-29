// Convex Auth's settings on a Convex deployment: its key pair (AUTH_PRIVATE_KEY, AUTH_JWKS), which
// signs the access tokens, and the web app's origin (SITE_URL). A push fails while one is missing.
//
//   bun run convex:auth env      sets the missing ones, leaving any that are set
//   bun run convex:auth check    says which are set and whether the key pair matches. Changes nothing
//   bun run convex:auth rotate   replaces the key pair, which signs everyone out. Asks first
//
// Each takes the deployment: none for the dev deployment, `--prod` for production, `--preview`
// for the defaults each new preview deployment copies. `env` takes `--site-url <url>` (on dev,
// http://localhost:3000), and `rotate` takes `--skip-confirmation`.
import { spawnSync } from "node:child_process";
import { createPrivateKey, createPublicKey, generateKeyPairSync, randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";

const backendDir = join(import.meta.dirname, "../packages/backend");

export type Target = "dev" | "prod" | "preview";

function convex(target: Target, command: "get" | "set", args: string[]) {
  const scope =
    target === "preview" ? ["env", "default", command, "--type", "preview"] : ["env", command];
  // The running Bun binary, not "bun" on PATH, as in setup.ts.
  return spawnSync(
    process.execPath,
    ["x", "convex", ...scope, ...args, ...(target === "prod" ? ["--prod"] : [])],
    { cwd: backendDir, encoding: "utf8" },
  );
}

/** The value, or "" when the variable isn't set (`convex env get` exits 0 either way). */
function get(target: Target, name: string) {
  return convex(target, "get", [name]).stdout.trim();
}

function set(target: Target, name: string, value: string) {
  // Through a file, not an argument: on Windows, the quotes in AUTH_JWKS's JSON wouldn't survive
  // the command line, and the private key stays out of the process list.
  const dir = mkdtempSync(join(tmpdir(), "auth-"));
  const file = join(dir, "value.txt");
  writeFileSync(file, value);
  const result = convex(target, "set", [name, "--from-file", file]);
  rmSync(dir, { recursive: true, force: true });
  if (result.status !== 0) {
    console.error(result.stderr);
    return false;
  }
  console.log(`${target}: set ${name}`);
  return true;
}

/** The key pair in the format of `npx @convex-dev/auth`: a base64 PKCS8 PEM and a JWKS. */
function generateKeys() {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const pem = privateKey.export({ type: "pkcs8", format: "pem" });
  const jwk = publicKey.export({ format: "jwk" });
  return {
    AUTH_PRIVATE_KEY: Buffer.from(pem).toString("base64"),
    AUTH_JWKS: JSON.stringify({ keys: [{ ...jwk, kid: randomUUID(), alg: "RS256", use: "sig" }] }),
  };
}

function setKeys(target: Target) {
  return Object.entries(generateKeys()).every(([name, value]) => set(target, name, value));
}

/** Sets the variables that are missing, and SITE_URL when `siteUrl` differs from it. */
export function ensureAuthEnv(target: Target, siteUrl: string | undefined) {
  if (!get(target, "AUTH_PRIVATE_KEY") || !get(target, "AUTH_JWKS")) {
    if (!setKeys(target)) return false;
  }
  if (siteUrl && get(target, "SITE_URL") !== siteUrl) return set(target, "SITE_URL", siteUrl);
  if (!get(target, "SITE_URL")) {
    console.error(`${target}: SITE_URL is not set. Pass --site-url with the web app's origin.`);
    return false;
  }
  return true;
}

/** Whether AUTH_JWKS holds the public half of AUTH_PRIVATE_KEY, so tokens it signs verify. */
function keysMatch(privateKey: string, jwks: string) {
  try {
    const pem = Buffer.from(privateKey, "base64").toString("utf8");
    const { n } = createPublicKey(createPrivateKey(pem)).export({ format: "jwk" });
    const { keys } = JSON.parse(jwks) as { keys: { n?: string }[] };
    return keys.some((key) => key.n === n);
  } catch {
    return false;
  }
}

/** Prints each variable by name, never a secret's value. False when a required one is wrong. */
function check(target: Target) {
  const privateKey = get(target, "AUTH_PRIVATE_KEY");
  const jwks = get(target, "AUTH_JWKS");
  const siteUrl = get(target, "SITE_URL");
  const keys = !privateKey || !jwks ? "missing" : keysMatch(privateKey, jwks) ? "ok" : "mismatch";
  const rows = [
    ["AUTH_PRIVATE_KEY", privateKey ? "set" : "missing"],
    ["AUTH_JWKS", jwks ? "set" : "missing"],
    ["key pair", keys === "mismatch" ? "mismatch: run `rotate` to replace it" : keys],
    ["SITE_URL", siteUrl || "missing"],
    ["RESEND_API_KEY", get(target, "RESEND_API_KEY") ? "set" : "unset: emails are logged"],
    ["AUTH_EMAIL_FROM", get(target, "AUTH_EMAIL_FROM") || "unset"],
  ];
  for (const [name, status] of rows) console.log(`${target}: ${name.padEnd(16)} ${status}`);
  return keys === "ok" && Boolean(siteUrl);
}

async function rotate(target: Target, skipConfirmation: boolean) {
  if (!skipConfirmation) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question(
      `Replace the key pair on ${target}? Everyone signed in is signed out. Type "rotate" to confirm: `,
    );
    rl.close();
    if (answer.trim() !== "rotate") {
      console.log("Nothing changed.");
      return false;
    }
  }
  return setKeys(target);
}

if (import.meta.main) {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      prod: { type: "boolean" },
      preview: { type: "boolean" },
      "site-url": { type: "string" },
      "skip-confirmation": { type: "boolean" },
    },
  });
  const target: Target = values.prod ? "prod" : values.preview ? "preview" : "dev";
  const command = positionals[0];
  let ok: boolean;
  if (command === "env") {
    const siteUrl = values["site-url"] ?? (target === "dev" ? "http://localhost:3000" : undefined);
    ok = ensureAuthEnv(target, siteUrl);
  } else if (command === "check") {
    ok = check(target);
  } else if (command === "rotate") {
    ok = await rotate(target, values["skip-confirmation"] ?? false);
  } else {
    console.error(
      "Usage: bun run convex:auth <env|check|rotate> [--prod | --preview] [--site-url <url>]" +
        " [--skip-confirmation]",
    );
    ok = false;
  }
  process.exit(ok ? 0 : 1);
}
