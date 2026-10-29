// The app's Cloudflare tasks.
//
//   bun scripts/cloudflare.ts build    the build command of Workers Builds (`bun run
//                                      build:cloudflare` in apps/web). Not for running by hand
//
// `build` installs the workspace, then runs `convex deploy`, which pushes the Convex functions
// and builds apps/web with VITE_CONVEX_URL pointing at them:
//   - production branch (PRODUCTION_BRANCH, default main): CONVEX_DEPLOY_KEY, a production
//     deploy key. Workers Builds then runs `cf deploy --prebuilt`.
//   - any other branch: CONVEX_PREVIEW_DEPLOY_KEY, a preview deploy key. Convex creates a
//     preview deployment named after the branch, and reuses it on later pushes. The app is
//     built as a preview (CLOUDFLARE_PREVIEW_BUILD), and Workers Builds then runs
//     `cf previews deploy --prebuilt`. The preview deployment's SITE_URL is then pointed at
//     the branch's Preview URL, so its auth emails link to the preview.
// It runs no checks: GitHub Actions' `ready` check does. main's ruleset
// (.github/rulesets/main.json) only takes pull requests that pass it, so nothing unchecked
// reaches production.
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { parseArgs } from "node:util";

const { positionals } = parseArgs({ allowPositionals: true });
if (positionals[0] !== "build") {
  console.error("Usage: bun scripts/cloudflare.ts build");
  process.exit(1);
}

const rootDir = join(import.meta.dirname, "..");
const branch = process.env.WORKERS_CI_BRANCH;
const productionBranch = process.env.PRODUCTION_BRANCH || "main";

if (!branch) {
  console.error(
    "WORKERS_CI_BRANCH is not set. This script runs in Workers Builds. To deploy by hand, see the README.",
  );
  process.exit(1);
}

const isProduction = branch === productionBranch;
const keyName = isProduction ? "CONVEX_DEPLOY_KEY" : "CONVEX_PREVIEW_DEPLOY_KEY";
const deployKey = process.env[keyName];
if (!deployKey) {
  console.error(`${keyName} is not set. Add it under Settings > Build > Variables and secrets.`);
  process.exit(1);
}

function run(command: string, args: string[], env?: NodeJS.ProcessEnv) {
  const result = spawnSync(command, args, { cwd: rootDir, stdio: "inherit", env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

/** Runs the Convex CLI against the branch's preview deployment and returns its output. */
function previewEnv(args: string[]) {
  const result = spawnSync("bun", ["x", "convex", "env", ...args, "--preview-name", branch!], {
    cwd: join(rootDir, "packages/backend"),
    encoding: "utf8",
    env: { ...process.env, CONVEX_DEPLOY_KEY: deployKey },
  });
  if (result.status !== 0) {
    console.error(result.stderr);
    process.exit(result.status ?? 1);
  }
  return result.stdout.trim();
}

/**
 * Every preview deployment copies production's SITE_URL from the preview defaults, so its emails
 * would link to production. Points it at the branch's Preview URL instead:
 * <preview name>-<worker>.<subdomain>.workers.dev, where the preview name is the branch,
 * lowercased, with other characters than letters, digits and "-" replaced by "-". Cloudflare
 * shortens a name that makes that first label longer than 63 characters and adds a hash, which
 * can't be worked out here, so those previews keep production's SITE_URL.
 */
function setPreviewSiteUrl() {
  const siteUrl = new URL(previewEnv(["get", "SITE_URL"]));
  const previewName = branch!.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const [label, ...rest] = siteUrl.hostname.split(".");
  if (!siteUrl.hostname.endsWith(".workers.dev")) {
    console.log(`SITE_URL ${siteUrl.origin} isn't on workers.dev; leaving it.`);
    return;
  }
  if (label!.startsWith(`${previewName}-`)) return;
  const previewLabel = `${previewName}-${label}`;
  if (previewLabel.length > 63) {
    console.log(`The Preview URL for ${branch} is shortened by Cloudflare; leaving SITE_URL.`);
    return;
  }
  const previewUrl = `${siteUrl.protocol}//${[previewLabel, ...rest].join(".")}`;
  previewEnv(["set", "SITE_URL", previewUrl]);
  console.log(`Set the preview deployment's SITE_URL to ${previewUrl}.`);
}

console.log(`Branch ${branch}: ${isProduction ? "production" : "preview"} build.`);
run("bun", ["install", "--frozen-lockfile"]);
run(
  "bun",
  [
    "run",
    "--cwd",
    "packages/backend",
    "deploy",
    ...(isProduction ? [] : ["--preview-name", branch]),
  ],
  {
    ...process.env,
    CONVEX_DEPLOY_KEY: deployKey,
    ...(isProduction ? {} : { CLOUDFLARE_PREVIEW_BUILD: "true" }),
  },
);
if (!isProduction) setPreviewSiteUrl();
