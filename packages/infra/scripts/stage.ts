// Deploys or removes one stage, in the order nothing else knows:
//   bun run --cwd packages/infra stage deploy dev-chridev --profile tcs-dev
//   bun run --cwd packages/infra stage destroy dev-chridev --profile tcs-dev
// In CI, leave out --profile: AWS credentials come from the environment.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BACKEND_IMAGE } from "../lib/backend.ts";
import { REGION, stageInfo } from "../lib/plane.ts";

const infraDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const backendDir = join(infraDir, "..", "backend");
const rootDir = join(infraDir, "..", "..");

const [action, stageName, ...flags] = process.argv.slice(2);
const profileAt = flags.indexOf("--profile");
const profile = profileAt === -1 ? undefined : flags[profileAt + 1];
if ((action !== "deploy" && action !== "destroy") || !stageName) {
  console.error("Usage: stage <deploy|destroy> <stage> [--profile <profile>]");
  process.exit(1);
}
const info = stageInfo(stageName);
const { stage, plane, instanceName, database, hosts } = info;

const awsEnv = {
  ...process.env,
  AWS_REGION: REGION,
  ...(profile ? { AWS_PROFILE: profile } : {}),
};

function run(command: string, args: string[], options: { cwd?: string; env?: NodeJS.ProcessEnv }) {
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.status !== 0) throw new Error(`${command} ${args[0]} failed.`);
}

/** Its output is a secret, so it's captured and never echoed. */
function capture(command: string, args: string[], env: NodeJS.ProcessEnv = awsEnv) {
  const result = spawnSync(command, args, { encoding: "utf8", env });
  if (result.status !== 0) throw new Error(`${command} ${args[0]}: ${result.stderr}`);
  return result.stdout.trim();
}

function getParameter(name: string) {
  return capture("aws", [
    "ssm",
    "get-parameter",
    "--with-decryption",
    "--name",
    name,
    "--query",
    "Parameter.Value",
    "--output",
    "text",
  ]);
}

function provision(provisionAction: "create" | "delete") {
  console.log(`Provisioner: ${provisionAction} ${database}`);
  const outputFile = join(mkdtempSync(join(tmpdir(), "stage-")), "output.json");
  capture("aws", [
    "lambda",
    "invoke",
    "--function-name",
    `tcs-${plane.name}-provisioner`,
    "--cli-binary-format",
    "raw-in-base64-out",
    "--cli-read-timeout",
    "120",
    "--payload",
    JSON.stringify({ action: provisionAction, stage, instanceName, database }),
    outputFile,
  ]);
  const output = readFileSync(outputFile, "utf8");
  if (!output.includes('"ok":true')) throw new Error(`Provisioner failed: ${output}`);
}

/** `generate_key` only exists in the backend image. The key stays out of the task. */
function adminKey() {
  const name = `/tcs/${stage}/convex/admin-key`;
  const existing = spawnSync(
    "aws",
    ["ssm", "get-parameter", "--with-decryption", "--name", name, "--query", "Parameter.Value"],
    { encoding: "utf8", env: awsEnv },
  );
  if (existing.status === 0) return JSON.parse(existing.stdout) as string;
  const printed = capture(
    "docker",
    [
      "run",
      "--rm",
      "-e",
      "INSTANCE_NAME",
      "-e",
      "INSTANCE_SECRET",
      "--entrypoint",
      "sh",
      BACKEND_IMAGE,
      "-c",
      './generate_key "$INSTANCE_NAME" "$INSTANCE_SECRET"',
    ],
    {
      ...process.env,
      INSTANCE_NAME: instanceName,
      INSTANCE_SECRET: getParameter(`/tcs/${stage}/convex/instance-secret`),
    },
  );
  const key = printed
    .split("\n")
    .map((line) => line.trim())
    .reverse()
    .find((line) => /^[a-z0-9-]+\|[0-9a-f]+$/i.test(line));
  if (!key) throw new Error("generate_key printed no admin key. Is Docker running?");
  capture("aws", [
    "ssm",
    "put-parameter",
    "--type",
    "SecureString",
    "--name",
    name,
    "--value",
    key,
  ]);
  return key;
}

function alchemy(command: "deploy" | "destroy", extraEnv: NodeJS.ProcessEnv) {
  run(
    join(infraDir, "node_modules/.bin/alchemy"),
    [
      command,
      "--config",
      "app/alchemy.run.ts",
      "--stage",
      stage,
      ...(profile ? ["--profile", profile] : []),
      "--yes",
      "--no-input",
    ],
    { cwd: infraDir, env: { ...process.env, ...extraEnv } },
  );
}

async function waitForBackend(url: string) {
  const deadline = Date.now() + 10 * 60 * 1000;
  while (Date.now() < deadline) {
    const up = await fetch(`${url}/version`, { signal: AbortSignal.timeout(5000) }).then(
      (response) => response.ok,
      () => false,
    );
    if (up) return;
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  throw new Error(`${url} didn't come up in 10 minutes.`);
}

const originSecret = () => getParameter(`/tcs/${plane.name}/router/origin-secret`);

if (action === "deploy") {
  const convexUrl = `https://${hosts.cloud}`;
  provision("create");
  const key = adminKey();
  alchemy("deploy", { ORIGIN_SECRET: originSecret(), VITE_CONVEX_URL: convexUrl });
  console.log(`Waiting for ${convexUrl}`);
  await waitForBackend(convexUrl);
  const convexEnv = {
    ...process.env,
    CONVEX_SELF_HOSTED_URL: convexUrl,
    CONVEX_SELF_HOSTED_ADMIN_KEY: key,
  };
  run("bun", ["run", "convex:auth", "env", "--site-url", `https://${hosts.web}`], {
    cwd: rootDir,
    env: convexEnv,
  });
  run("bun", ["x", "convex", "deploy", "--yes"], { cwd: backendDir, env: convexEnv });
  console.log(`\nhttps://${hosts.web}`);
} else {
  if (plane.protected) throw new Error("Stage prod is never destroyed by this script.");
  alchemy("destroy", { ORIGIN_SECRET: originSecret(), VITE_CONVEX_URL: `https://${hosts.cloud}` });
  provision("delete");
}
