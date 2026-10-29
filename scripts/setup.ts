// One-time local setup, safe to re-run. On a fresh clone it makes an anonymous Convex deployment
// on this machine, which needs no account, as `bun run convex:local` does. Once there's a
// deployment, local or cloud, it sets the variables Convex Auth needs on it if they're missing,
// pushes the functions, and writes VITE_CONVEX_URL for the web app.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ensureAuthEnv } from "./auth.js";

const root = join(import.meta.dirname, "..");
const backendDir = join(root, "packages/backend");
const backendEnv = join(backendDir, ".env.local");

// The running Bun binary, not "bun" on PATH: on Windows that can be a .cmd shim (vp's or
// npm's), which spawnSync can't run without a shell.
const bun = process.execPath;

const hasDeployment =
  existsSync(backendEnv) && /^CONVEX_DEPLOYMENT=./m.test(readFileSync(backendEnv, "utf8"));
if (!hasDeployment) {
  const result = spawnSync(bun, ["scripts/convex.ts", "local"], {
    cwd: root,
    stdio: "inherit",
  });
  process.exit(result.status ?? 1);
}

// Without a terminal on stdin, `convex dev` doesn't offer to link an anonymous deployment to
// your account, as in convex.ts.
const ok =
  ensureAuthEnv("dev", "http://localhost:3000") &&
  spawnSync(bun, ["x", "convex", "dev", "--once"], {
    cwd: backendDir,
    stdio: ["ignore", "inherit", "inherit"],
  }).status === 0 &&
  spawnSync(bun, ["scripts/sync-env.ts"], { cwd: root, stdio: "inherit" }).status === 0;
process.exit(ok ? 0 : 1);
