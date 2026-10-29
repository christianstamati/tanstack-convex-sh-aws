<!-- Made with the header builder at https://shieldcn.dev/header: one image per GitHub theme. -->
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://shieldcn.dev/header/dots.svg?title=tanstack-convex-sh-aws&subtitle=TanStack+Start%2C+Convex+and+shadcn%2Fui+on+Cloudflare+Workers&logo=convex&mode=dark">
  <source media="(prefers-color-scheme: light)" srcset="https://shieldcn.dev/header/dots.svg?title=tanstack-convex-sh-aws&subtitle=TanStack+Start%2C+Convex+and+shadcn%2Fui+on+Cloudflare+Workers&logo=convex&mode=light">
  <img alt="tanstack-convex-sh-aws: TanStack Start, Convex and shadcn/ui on Cloudflare Workers" src="https://shieldcn.dev/header/dots.svg?title=tanstack-convex-sh-aws&subtitle=TanStack+Start%2C+Convex+and+shadcn%2Fui+on+Cloudflare+Workers&logo=convex&mode=light">
</picture>

A boilerplate TypeScript monorepo with a TanStack Start web app, a Convex backend and
shadcn/ui on Base UI, set up to deploy to Cloudflare Workers. Users sign up with email and
password, and pages render on the server as the signed-in user. It includes one example
feature, a private notes list, to show the wiring end to end.

## Stack

| Layer    | Choice                                                                                  |
| -------- | --------------------------------------------------------------------------------------- |
| Monorepo | Bun workspaces, Vite+ (`vp`) for format, lint, type check, tests and tasks              |
| Frontend | TanStack Start (React) in `apps/web`, with TanStack Query                               |
| Backend  | Convex in `packages/backend`. Functions are the API, no separate server                 |
| Auth     | Convex Auth 2.0 beta, email and password, sessions in httpOnly cookies                  |
| UI       | shadcn/ui on Base UI and Tailwind CSS v4 in `packages/ui`. Nova, neutral, Lucide, Geist |
| Tests    | Vitest, with convex-test for Convex functions                                           |
| CI       | GitHub Actions: check, test, build, audit, CodeQL. Renovate for updates                 |
| Deploy   | Cloudflare Workers Builds for the web app, Convex Cloud for the backend, with previews  |

The backend follows
[ianmacartney/code-organization-pattern](https://github.com/ianmacartney/code-organization-pattern).
Each table's functions are defined in `convex/models/<table>/`, and `convex/api/<table>.ts`
re-exports the ones that make up the public API. The web app calls them as
`api.<table>.<function>` through `apps/web/src/lib/api.ts`.

## Quick start

Works on macOS, Linux and Windows (x64).

### With a coding agent

Clone the repo, open a coding agent (Claude Code, Codex, Cursor…) in it and paste:

```text
Set up this repo for local development. Read AGENTS.md and the Quick start in README.md
first. Install the global Vite+ CLI (`vp`) if it is missing, then run `bun install` and
`bun run setup` from the repo root, which makes a local Convex deployment without an
account. Start `bun run dev` in the background, check that
http://localhost:3000 and its Notes page load, then run `bun run ready`. Don't log in to
Convex or Cloudflare. Tell me what you ran and anything that failed.
```

Or follow the steps below yourself.

### Prerequisites

| Tool         | Version                       | Install                            |
| ------------ | ----------------------------- | ---------------------------------- |
| Git          | any recent                    | [git-scm.com](https://git-scm.com) |
| Vite+ (`vp`) | global CLI                    | see below                          |
| Node         | 24.22.1, from `.node-version` | installed by `vp`                  |
| Bun          | 1.4.4, from `packageManager`  | installed by `vp`                  |

Install the global `vp` CLI and let it manage Node and package managers when the installer
asks:

```sh
# macOS / Linux
curl -fsSL https://vite.plus | bash
```

```powershell
# Windows (PowerShell), or run vp-setup.exe from https://setup.viteplus.dev
irm https://vite.plus/ps1 | iex
```

Open a new terminal. In this repo, `node` and `bun` then resolve to the versions the
repo pins; `vp env current` shows them. If you already have Node 24 and Bun 1.4.4
installed yourself, you can skip `vp`: the repo's `vp` comes from `node_modules`.

No Convex or Cloudflare account is needed to start.

### Run it

```sh
git clone <this repo>
cd tanstack-convex-sh-aws
bun install     # dependencies and the Git hooks
bun run setup   # local Convex deployment and apps/web/.env.local
bun run dev     # Convex + http://localhost:3000
```

`setup` creates an anonymous Convex deployment that runs on your machine and stores its data in
`packages/backend/.convex/`, as `bun run convex:local` does. It needs no account and never asks
you to log in. It also sets the variables auth needs on the deployment. You can re-run it, and
once there's a deployment, local or cloud, it keeps that one. Open http://localhost:3000, sign
up and try the Notes page.

Sign-up sends a link to verify the email. Until you set `RESEND_API_KEY` (see
[Auth](#auth)), nothing is sent. `bun run dev` prints the email and its link instead. Open the
link in the browser you signed up in.

If you've logged in to Convex on this machine, `bun run dev` may ask "CONVEX_DEPLOYMENT is
configured with deployment …, which is not linked with your account. Would you like to link it
now?" Answer **n** to keep developing locally. To use the cloud, run `bun run convex:cloud`.

On Windows, use PowerShell or Windows Terminal. Git Bash works too. The Git hooks run under
the `sh` that ships with Git for Windows. A few commands in this README are written for `sh`.
To run one in PowerShell, set a `NAME=value` prefix first with `$env:NAME = "value"`, and run
the parts of an `a && b` one at a time. Git Bash runs them as written.

Every command, with its options, is in [Commands](#commands).

### Local or cloud Convex

`setup` starts you on a Convex deployment on your machine, which needs no account. To develop
against Convex Cloud instead, which does, or to switch back:

```sh
bun run convex:cloud   # your dev deployment on Convex Cloud. Logs in, and links a project the first time
bun run convex:local   # the deployment on your machine. No account or login
bun run convex:which   # which one the app uses now
```

A switch selects the deployment in `packages/backend/.env.local`, sets the auth variables on
it if they're missing, pushes the functions and points `apps/web/.env.local` at it. Restart
`bun run dev` afterwards. Each deployment keeps its own data, so seed the other one with
`bun run convex:seed`. The cloud dev deployment is yours alone, and production and previews
stay separate (see [Deploy](#deploy)).

The local deployment is anonymous. It isn't linked to an account even when you're logged in,
and `bun run convex:dashboard` opens its dashboard on http://127.0.0.1:6790. While it's in use,
`CONVEX_CLOUD_PROJECT` in `packages/backend/.env.local` remembers the cloud project (as
`team:project`), so `convex:cloud` goes back to it without asking.

## Commands

Run them from the repo root.

### Develop

- **`bun install`** installs the dependencies and the Git hooks. The pre-commit hook runs
  `vp check --fix` on the staged files.
- **`bun run setup`** gets a fresh clone running, and is safe to re-run. Without a Convex
  deployment, it creates an anonymous one on your machine, as `convex:local` does. Then it sets
  the auth variables on the deployment if they're missing, pushes the functions and writes
  `apps/web/.env.local`. A deployment that's already there, local or cloud, stays.
- **`bun run dev`** points `apps/web/.env.local` at the deployment, then runs `convex dev` and
  the web app on http://localhost:3000. `convex dev` pushes the functions on every change and
  prints their logs and the auth emails. On the local deployment, it also runs the Convex
  backend and its dashboard.

### Convex deployment

- **`bun run convex:local`** switches to the anonymous deployment on your machine, creating one
  the first time. It needs no account or login.
- **`bun run convex:cloud`** switches to your personal dev deployment on Convex Cloud. It logs
  in if you're logged out, and the first time it asks you to pick or create a project.
- **`bun run convex:which`** prints the deployment in use and its URL. It changes nothing.
- **`bun run convex:dashboard`** opens the Convex dashboard: on http://127.0.0.1:6790 for the
  local deployment while `dev` runs, and on dashboard.convex.dev for a cloud one.

[Local or cloud Convex](#local-or-cloud-convex) explains what a switch does.

### Data

- **`bun run convex:seed`** signs up ada@example.com, verifies its email, and gives it a name
  and two notes. Its password is `Test!12345`. The seed skips an email that already has an
  account, so you can re-run it, including after `convex:reset`. It refuses to run unless
  `SITE_URL` is a localhost URL and `RESEND_API_KEY` is unset, so the known password never
  reaches a deployment others can open. The user is defined in
  `packages/backend/convex/models/seed/`.
- **`bun run convex:reset`** deletes every document on the dev deployment, including the
  components' users, sessions, passwords and emails. The functions, the schema and the env vars
  stay. It asks you to type "reset" first, unless you pass `--skip-confirmation` (or `-y`). On
  the local deployment, `dev` must be running. It never touches production.

### Auth

`bun run convex:auth <subcommand>` manages Convex Auth's variables on a deployment. Those are
the key pair that signs the access tokens (`AUTH_PRIVATE_KEY`, `AUTH_JWKS`) and the web app's
origin (`SITE_URL`). It targets the dev deployment by default, production with `--prod`, and
the defaults each new preview deployment copies with `--preview`.

- **`env`** sets the variables that are missing and keeps the ones that are set.
  `--site-url <url>` sets `SITE_URL`, which on the dev deployment defaults to
  http://localhost:3000. `setup` and the switches run it for you.
- **`check`** lists the variables, without the secrets' values, and checks that the two keys
  belong together. It exits with 1 when a required one is missing or wrong.
- **`rotate`** replaces the key pair, which signs everyone out. It asks you to type "rotate"
  first, unless you pass `--skip-confirmation`.

### Check and build

- **`bun run check`** formats, lints and type checks (`vp check`). `vp check --fix` fixes what
  it can.
- **`bun run test`** runs the unit tests: Vitest for the web app and convex-test for the Convex
  functions.
- **`bun run build`** builds apps/web for production, into `apps/web/.cloudflare/output/`.
  `bun run --cwd apps/web preview` serves that build on http://localhost:4173.
- **`bun run ready`** runs check, test and build. CI runs it as the `ready` check on every pull
  request and push to `main`; run it before you push.

### Cloudflare

- **`bun run build:cloudflare`**, in apps/web, is the build command of Workers Builds. It runs
  `scripts/cloudflare.ts build`, which deploys the Convex functions for the branch and builds
  the app against them. It needs the variables Workers Builds sets, so it stops if you run it
  by hand. To deploy, see [Deploy](#deploy).

## Environment variables

`bun run setup` writes the local files. `.env.example` documents every variable.

| Variable                        | Where                               | Set by                                 | Purpose                                   |
| ------------------------------- | ----------------------------------- | -------------------------------------- | ----------------------------------------- |
| `VITE_CONVEX_URL`               | `apps/web/.env.local`, deploy build | `scripts/sync-env.ts`, `convex deploy` | Convex URL the browser connects to        |
| `CONVEX_DEPLOYMENT`             | `packages/backend/.env.local`       | `convex dev`                           | Deployment the Convex CLI targets         |
| `CONVEX_URL`, `CONVEX_SITE_URL` | `packages/backend/.env.local`       | `convex dev`                           | Deployment URLs                           |
| `CONVEX_CLOUD_PROJECT`          | `packages/backend/.env.local`       | `scripts/convex.ts`                    | Cloud project `convex:cloud` goes back to |
| `CONVEX_DEPLOY_KEY`             | Workers Builds secret               | you                                    | Deploys `main` to Convex production       |
| `CONVEX_PREVIEW_DEPLOY_KEY`     | Workers Builds secret               | you                                    | Deploys other branches to Convex previews |

Env vars a Convex function reads live on the deployment, not in a file. They are declared in
`packages/backend/convex/convex.config.ts`, and a push fails while a required one is missing.
Set them from `packages/backend` with `bunx convex env set NAME value`.

| Variable                        | Required | Set by                    | Purpose                                       |
| ------------------------------- | -------- | ------------------------- | --------------------------------------------- |
| `AUTH_PRIVATE_KEY`, `AUTH_JWKS` | yes      | `bun run convex:auth env` | Key pair that signs the access tokens         |
| `SITE_URL`                      | yes      | `bun run convex:auth env` | The web app's origin; email links point at it |
| `RESEND_API_KEY`                | no       | you                       | Sends auth emails. Without it they're logged  |
| `AUTH_EMAIL_FROM`               | no       | you                       | From address on your Resend domain            |

## Auth

Auth is [Convex Auth](https://github.com/get-convex/convex-auth) 2.0.0-beta.0 with email and
password. Sign-up sends a link that verifies the email, and a forgotten password gets a reset
link. The session lives in httpOnly cookies on the web app's origin, through
[@samebase/convex-auth-tanstack-start](https://github.com/samebase/convex-hosting/tree/main/packages/convex-auth-tanstack-start),
so the server renders each page as the user. Convex Auth doesn't ship a TanStack Start
integration yet. That package fills in until it does, and it requires exactly this beta.
[KNOWN_ISSUES.md](KNOWN_ISSUES.md) lists what the beta can't do yet and what isn't built.

- `apps/web/src/server.ts`, the Worker, answers `/auth/signin`, `/auth/refresh` and
  `/auth/signout` and passes the session to TanStack Start.
- Pages under `apps/web/src/routes/_authed/` need a session. Without one, the visitor goes
  to `/signin` and comes back after signing in.
- The pages are `/signin`, `/signup`, `/verify-email`, `/forgot-password` and
  `/reset-password`.
- In Convex, `authQuery`, `authMutation` and `authAction` from `convex/lib/auth.ts` require
  a session and give the handler `ctx.userId`.
- Sign-up creates the user before the email is verified. A day later, a scheduled
  `removeUnverifiedUser` deletes the user if they never verified it. For users created before
  that check existed, run
  `bunx convex run internal/users:removeUnverifiedUsers` in `packages/backend`. Add
  `"{includeRecent: true}"` to skip the 24-hour wait, which also removes anyone who just
  signed up and hasn't opened their link yet.
- Opening the link sets `verifiedAt` on the user, so `verifiedUsers(ctx)` in
  `convex/models/users/functions.ts` lists Users without Unverified users through an index.
  On a deployment with users verified before `verifiedAt` existed, run
  `bunx convex run internal/users:backfillVerifiedAt` in `packages/backend` once.

To send real emails, create a [Resend](https://resend.com) API key, verify a domain, and set
`RESEND_API_KEY` and `AUTH_EMAIL_FROM` (such as `My App <auth@example.com>`) on the
deployment. Resend's default sender, `onboarding@resend.dev`, only delivers to your own
Resend account's address.

### Rate limits

Convex Auth limits sign-in attempts and auth emails by itself. Limits on the app's own functions
live in `packages/backend/convex/lib/rateLimits.ts`, on the
[rate limiter component](https://www.convex.dev/components/rate-limiter). A function calls
`enforceRateLimit(ctx, name, ctx.userId)` before doing its work. Over the limit it throws
`rate_limited`, which the web app shows as "Too many requests. Try again in N seconds."
`notes.create` is the example. It lets a user add 10 notes at once, then 30 a minute.

## Deploy

Cloudflare Workers Builds builds and deploys the app from the GitHub repo. Every push to
`main` deploys production. Every other branch gets a Cloudflare Preview URL, posted on its
pull request and backed by its own Convex preview deployment.

### Requirements

| Need                                                        | Required | For                                                                       |
| ----------------------------------------------------------- | -------- | ------------------------------------------------------------------------- |
| A GitHub repo with this code                                | yes      | Workers Builds builds from it and posts Preview URLs on its pull requests |
| [Convex Cloud](https://dashboard.convex.dev) account        | yes      | The production deployment and one preview deployment per branch           |
| [Cloudflare](https://dash.cloudflare.com) account           | yes      | The Worker, its workers.dev URL, and Workers Builds                       |
| The [Quick start](#quick-start) done                        | yes      | `bun install` and `bun run setup`, so the CLIs and scripts run            |
| [Resend](https://resend.com) account with a verified domain | no       | Sends auth emails. Without it they're only logged, so no one can verify   |

### With a coding agent

Log in to Convex and Cloudflare first, so the agent never signs in for you:
`cd packages/backend && bunx convex login`, then `cd apps/web && bunx cf auth login`. Then
paste:

```text
Deploy this app to my Convex Cloud and Cloudflare accounts. Read AGENTS.md and the Deploy
section of README.md first. I'm logged in to both CLIs; don't log in or out. The Convex and
Cloudflare MCP servers can't deploy, so use the `convex` and `cf` CLIs.
1. If `bun run convex:which` prints a local deployment, run `bun run convex:cloud` from the
   repo root to create a Convex Cloud project and use its dev deployment.
2. Find the production deployment's URL (`https://<name>.<region>.convex.cloud`) with the
   Convex MCP `status` tool on packages/backend, or in the dashboard. Build the web app
   against it: `VITE_CONVEX_URL=<url> bun run --cwd apps/web build`, then run
   `bunx cf deploy --prebuilt` in apps/web. It prints the workers.dev URL; SITE_URL needs it.
3. From the repo root, run `bun run convex:auth env --prod --site-url <workers.dev URL>`
   and `bun run convex:auth env --preview --site-url <workers.dev URL>`. Then run
   `bunx convex deploy -y` in packages/backend.
4. Check that <workers.dev URL>/health answers {"status":"ok","convex":"up"} and /signin
   loads without console errors. Don't sign up on production; I'll do that.
5. Create the production deploy key with `bunx convex deployment token create
   workers-builds-prod --prod --save-env <a file outside the repo>`, and don't print it.
6. Stop and give me the steps that need me: generate a Preview deploy key in the Convex
   dashboard, connect the repo under the Worker's Settings > Build with the settings in the
   README's table, and add CONVEX_DEPLOY_KEY (from that file) and CONVEX_PREVIEW_DEPLOY_KEY
   as build secrets. Never paste keys into a dashboard yourself.
When I say it's connected, check with the `cf builds` commands that both the production and
the previews build settings match the README's table (connecting fills in Cloudflare's
defaults) and that each has its deploy key, by name only. Fix the settings, not the secrets.
Then push a new branch, open a pull request, and check that its build posts a Preview URL,
creates a Convex preview deployment, and that the preview's /health answers ok. Once its
`ready` check has run, protect main with the ruleset command in the README's By hand step 4.
Tell me what you ran, the URLs, and anything that failed.
```

### By hand

1. Link a Convex Cloud project: `bun run convex:cloud`. It logs in, creates the project and
   points the app at its dev deployment. `bun run convex:local` switches back.
2. In the Convex dashboard, generate a production deploy key and a preview deploy key.
   Set the auth variables on production, and as the defaults that each new preview
   deployment copies, each with its own key pair:

   ```sh
   bun run convex:auth env --prod --site-url https://tanstack-convex-sh-aws.<subdomain>.workers.dev
   bun run convex:auth env --preview --site-url https://tanstack-convex-sh-aws.<subdomain>.workers.dev
   ```

   Add `RESEND_API_KEY` and `AUTH_EMAIL_FROM` the same way (`bunx convex env set --prod`,
   `bunx convex env default set --type preview`). Each preview deployment
   starts with production's `SITE_URL`, and the build then points it at the branch's
   Preview URL, so a preview's emails link to that preview.

3. In the Cloudflare dashboard, go to Workers & Pages > Create > Import a repository, pick
   this repo and set:

   | Setting         | Value                                                                   |
   | --------------- | ----------------------------------------------------------------------- |
   | Project name    | `tanstack-convex-sh-aws`, the `name` in `apps/web/cloudflare.config.ts` |
   | Root directory  | `apps/web`                                                              |
   | Build command   | `bun run build:cloudflare`                                              |
   | Deploy command  | `bunx cf deploy --prebuilt`                                             |
   | Preview command | `bunx cf previews deploy --prebuilt`                                    |
   | Build variables | `BUN_VERSION` = `1.4.4`, `SKIP_DEPENDENCY_INSTALL` = `1`                |
   | Build secrets   | `CONVEX_DEPLOY_KEY`, `CONVEX_PREVIEW_DEPLOY_KEY`                        |

   Settings > Build has a Production tab and a Previews Base tab, and connecting the repo
   fills both with Cloudflare's defaults. Set both, with the preview command on Previews
   Base. Production needs `CONVEX_DEPLOY_KEY` and Previews Base `CONVEX_PREVIEW_DEPLOY_KEY`.
   Check that `main` is the production branch. Each branch copies Previews Base on its first
   push, so set it up before pushing branches. The commands use `bunx`, not the default
   `npx`, because npm refuses to run in a repo whose `devEngines` names Bun.

4. Protect `main`, from the repo root, with the [GitHub CLI](https://cli.github.com) signed
   in as a repo admin:

   ```sh
   gh api --method POST repos/{owner}/{repo}/rulesets --input .github/rulesets/main.json
   gh api --method PATCH repos/{owner}/{repo} -F allow_merge_commit=false -F allow_rebase_merge=false -f squash_merge_commit_title=PR_TITLE -f squash_merge_commit_message=PR_BODY -F allow_auto_merge=true -F delete_branch_on_merge=true
   ```

   The second command leaves squash as the only merge button, with the pull request's title
   and description as the commit message. It also turns on auto-merge, so a pull request can
   be set to merge once its checks pass, and deletes each branch once its PR merges.

   The build runs no checks, so this ruleset is what keeps failing code out of production.
   It needs the `ready` check to have run once, which the first push does. In a private repo
   without GitHub Advanced Security, CodeQL doesn't run, so first remove the `code_scanning`
   rule from the file, or no pull request can merge.

To deploy production from your machine instead, sign in with `bunx cf auth` in `apps/web`, then
run `CONVEX_DEPLOY_KEY=... bun run --cwd packages/backend deploy && bun run --cwd apps/web deploy`.
That skips the checks, so run `bun run ready` first.

### What a build does

The build command runs `scripts/cloudflare.ts build`. It installs the workspace from the
repo root, then runs `convex deploy`. That pushes the Convex functions and builds the app
with `VITE_CONVEX_URL` pointing at them.

- On `main`, it uses `CONVEX_DEPLOY_KEY` and the production deployment. Cloudflare then runs
  the deploy command.
- On any other branch, it uses `CONVEX_PREVIEW_DEPLOY_KEY`. Convex creates a preview
  deployment named after the branch and reuses it on later pushes. The script sets
  `CLOUDFLARE_PREVIEW_BUILD=true` so the app builds as a preview, and Cloudflare then runs
  the preview command.

The build writes the Worker to `apps/web/.cloudflare/output/`. Both commands pass
`--prebuilt`, so they upload that output instead of building again. Cloudflare reports each
build as a check on the commit. The Worker's settings live in `apps/web/cloudflare.config.ts`,
which the Cloudflare Vite plugin 2.0 beta and the `cf` CLI beta read. See
[KNOWN_ISSUES.md](KNOWN_ISSUES.md) for their limits.

`bun run dev` and `vp preview` run the app in workerd, the Workers runtime, so what you test
locally runs on the same runtime as production.

### What protects main

The build script runs no checks. GitHub Actions runs `bun run ready` (format, lint, type
check, tests and the build) on every pull request and push to `main`, as the `ready` check
in `.github/workflows/ci.yml`. It needs no secrets and deploys nothing, so it also checks
pull requests from forks and from copies of the repo that aren't connected to Cloudflare.

Workers Builds deploys without waiting for GitHub Actions. The ruleset in
`.github/rulesets/main.json` makes up for that. Changes reach `main` through a pull request,
which can only merge once `ready` passes and CodeQL has scanned it. CodeQL blocks the merge on
a security alert of high severity or above, or on any other alert at error level.

Repo admins can still push to `main` directly and skip those checks. In a personal repo that's
only the owner, because GitHub doesn't let collaborators there be admins. In an organization,
remove the `bypass_actors` entry to require a pull request from everyone.

Pull requests are squash-merged, so each commit on `main` is one checked pull request, with
the PR's title and description as its message. Each PR gets a Cloudflare preview, built
whether or not its checks pass. Merging deploys production.

To change the ruleset, edit the file and update it with
`gh api --method PUT repos/{owner}/{repo}/rulesets/<id> --input .github/rulesets/main.json`.
`gh api repos/{owner}/{repo}/rulesets` lists the ids.

### Health check

`GET /health` on the web app answers `{"status":"ok","convex":"up"}` with status 200 while the
Worker runs and reaches Convex, and `{"status":"degraded","convex":"unreachable"}` with 503 when
Convex doesn't answer within 3 seconds. Point an uptime monitor at it. It asks the Convex
deployment's `/version`, so a check runs no Convex function.

### Search and link previews

`apps/web/src/lib/meta.ts` holds the app's name and description. Every page starts from
those tags, including the Open Graph tags that link previews read, and sets its own title
with `pageMeta`. Pages that need a session are `noindex`, and
`apps/web/public/robots.txt` allows the rest. To show an image in link previews, set
`og:image` in `siteMeta()` to an absolute URL of a 1200×630 PNG.

## Security checks

GitHub Actions runs these on every pull request and push to `main`:

| Check       | Workflow     | What it does                                                                                                                                                                                              |
| ----------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `audit`     | `ci.yml`     | `bun audit` on `bun.lock`, also every Monday. Fails on high or critical advisories in production dependencies; advisories in dev tooling (the Cloudflare CLI, the shadcn CLI…) only go to the job summary |
| `workflows` | `ci.yml`     | [zizmor](https://docs.zizmor.sh) audits the workflows: broad permissions, unpinned actions, credentials left in checkouts, template injection                                                             |
| `analyze`   | `codeql.yml` | [CodeQL](https://codeql.github.com) scans the TypeScript and the workflows. Results go to Security > Code scanning. Free on public repos; skipped on private ones without GitHub Advanced Security        |

To accept an advisory that doesn't affect the app, add `--ignore=<GHSA id>` to the audit
step in `ci.yml` with a comment saying why. Workflow actions are pinned to commit SHAs, and
Renovate keeps them current. GitHub's secret scanning and push protection are on for the
repo in its settings; they aren't workflows.

## Dependency updates

[Renovate](https://docs.renovatebot.com) opens pull requests that update the dependencies,
Node (`.node-version`), Bun (`packageManager` and `devEngines`) and the GitHub Actions, on
Monday mornings. To turn it on, install the [Renovate GitHub App](https://github.com/apps/renovate)
on the repo and merge the onboarding PR it opens. `renovate.json` holds the rules:

- Related packages update together in one PR: `convex`, `tanstack`, `cloudflare`,
  `vite-plus`.
- Convex Auth's beta and its TanStack Start adapter never update on their own. They're
  listed on the Dependency Dashboard issue, and a PR opens only when you tick them there.
- A Convex update can change `packages/backend/convex/_generated/`, which CI doesn't
  regenerate. Run `bun run setup` on the branch and commit any change before merging.
- Renovate doesn't read Bun's `workspaces.catalog` yet. A custom rule tracks the Vite+
  versions in it but can't update `bun.lock` for them, so run `bun install` on the branch and
  push the lockfile.
- Security fixes open right away, whatever the schedule. Renovate checks the
  [OSV](https://osv.dev) database, so this works without GitHub's Dependabot alerts.
- Workflow actions are pinned to commit SHAs and update together in one PR, along with the
  zizmor version in `ci.yml`.

Each Renovate branch also gets a Cloudflare preview and a Convex preview deployment.

## Start a product

A product starts as a copy of this repo and grows on its own; it doesn't pull later changes.
[CONTEXT.md](CONTEXT.md) defines the words the template uses, such as User, Account, Session and
Preview. Keep those terms, rewrite its first paragraph for the product, and add the product's own.

## Remove the example feature

Delete these files and lines, then run `bun run check`:

- `packages/backend/convex/models/notes/`, `packages/backend/convex/api/notes.ts` and
  `packages/backend/convex/tests/notes/`
- the `notes` table and its import in `packages/backend/convex/schema.ts`
- the `createNote` limit in `packages/backend/convex/lib/rateLimits.ts`
- `apps/web/src/routes/_authed/notes.tsx`
- the Notes links in `apps/web/src/routes/index.tsx` and `apps/web/src/routes/__root.tsx`
- `AFTER_SIGN_IN` in `apps/web/src/lib/auth.ts`: point it at your first private page
- the seed user's `notes`, and the insert below them, in
  `packages/backend/convex/models/seed/functions.ts`

`bun run dev` regenerates `apps/web/src/routeTree.gen.ts` and `convex/_generated`.
