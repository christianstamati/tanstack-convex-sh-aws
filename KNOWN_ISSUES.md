# Known issues

Auth runs on [Convex Auth](https://github.com/get-convex/convex-auth) 2.0.0-beta.0 and
[@samebase/convex-auth-tanstack-start](https://github.com/samebase/convex-hosting/tree/main/packages/convex-auth-tanstack-start)
0.1.1, both pinned to exact versions. This file lists what the beta can't do yet, what we
haven't built, and the workarounds in the code. When you upgrade, check each item again and
remove the ones that are fixed.

## Limits of the Convex Auth beta

- **Users can't be deleted completely.** The beta has no function to delete a user's account
  (`auth` component, `accounts` table) or password hash (`authPassword` component), only the
  email component's `verifiedEmails.deleteUser`. `removeIfUnverified` in
  `convex/models/users/functions.ts` deletes the user and their email data and leaves those two
  rows behind. They are unreachable, because sign-in finds a user only through a verified email.
  When the beta adds the functions, call them there.
- **A verification link can't be sent again.** The sign-up link works for an hour and email and
  password has no resend. A user who misses it can't sign in, and is removed after 24 hours
  (`UNVERIFIED_USER_TTL_MS`), after which they can sign up again.
- **Emails go through Resend only, with fixed text.** The beta sends through `@convex-dev/resend`
  and doesn't let the app change the subject or the body. Without `RESEND_API_KEY`, `logEmail`
  in `convex/models/users/auth.ts` takes Resend's place. It logs each email and stores it in
  the `devMailbox` table.
- **No magic links or one-time codes.** Email and password is the only email-based method.
- **Sessions aren't checked on each request.** `getAuthUserId` trusts the access token until it
  expires, about a minute, so a signed-out or deleted session keeps working until then.
- **A password reset doesn't end the user's other sessions.** `completePasswordRecovery` sets
  the new password and signs in the browser that reset it, but every other browser stays signed
  in, including one that knew the old password. The beta has no function to end all of a user's
  sessions; its code marks this as a TODO in `changePassword`. When it adds one, call it after a
  reset, and after a password change once the app has one.
- **No TanStack Start integration in Convex Auth.** It ships one for Next.js only.
  `@samebase/convex-auth-tanstack-start` fills the gap until Convex Auth has its own, and needs
  exactly 2.0.0-beta.0. Its `convexAuth()` Vite plugin resolves a file that the beta's exports
  map hides.
- **The setup CLI doesn't run in this repo.** `npx @convex-dev/auth` sets the keys with `npx`,
  which npm refuses here because `devEngines` names Bun. `scripts/auth.ts` generates the
  keys in the same format instead.
- **Test helpers need workarounds.** The beta's convex-test helpers ship as TypeScript with
  `.ts` imports (`allowImportingTsExtensions` in `convex/tsconfig.json`), and its password hashing
  imports a `.wasm` file that Vitest can't load (the `wasm-module` plugin in
  `packages/backend/vite.config.ts`).

## Limits of the Cloudflare betas

The web app builds with `@cloudflare/vite-plugin` 2.0.0-beta.v.6 and deploys with the `cf` CLI
1.0.0-beta.24, both pinned exactly. We moved off plugin 1.65.0 because it pinned a miniflare
with undici 7.29.1, which has 4 high-severity advisories. The beta's miniflare uses 7.30.1.

Deploying through `cf` works. We first deployed production by hand with
`bunx cf deploy --prebuilt`, and a Workers Builds preview with
`bunx cf previews deploy --prebuilt` deployed a branch against its own Convex preview
deployment. The catches are below.

- **Connecting the repo fills in Cloudflare's defaults.** The dashboard sets `bun run build`,
  `npx wrangler deploy` (`npx wrangler preview` for previews) and root `/` on both the
  Production and Previews Base tabs. Replace them with the README's settings on both tabs.
- **A branch's preview keeps the settings it was created with.** Each branch gets its own
  copy of Previews Base on its first push. A branch pushed before Previews Base was set up
  keeps the defaults and no secrets, so its builds fail; push the work to a new branch.
- **The plugin no longer reads `wrangler.jsonc`.** The Worker's settings are in
  `apps/web/cloudflare.config.ts`, and the build writes Cloudflare's build output to
  `apps/web/.cloudflare/output/` instead of a `dist/server/wrangler.json`. `wrangler deploy`
  can't deploy it.
- **`cf deploy` without `--prebuilt` fails here.** It builds with `npx vite build`, which npm
  refuses in a repo whose `devEngines` names Bun. Build with `bun run build`, then deploy
  with `--prebuilt`.
- **Preview builds need `CLOUDFLARE_PREVIEW_BUILD=true`.** `scripts/cloudflare.ts` sets
  it off the production branch; without it, `cf previews deploy --prebuilt` has no preview
  build to deploy.

When the plugin 2.0 and `cf` are stable, move to the stable versions and check each item again.

## Not built yet

- **Change password and change email.** The beta has `changePassword`, `startChangeEmail` and
  `completeChangeEmail`, and the React hooks for them. To add them, export them from
  `convex/api/auth.ts` and add the ones that complete a change to the `signIn` list in
  `apps/web/src/server.ts`. Each needs a page, plus `/confirm-email-change` for the email link.
- **A user deleting themselves.** Blocked by the first item above.
- **Sign-in with OAuth or passkeys.** The beta and the adapter support GitHub, Google, Apple and
  passkeys; none is set up.

## Our setup

- **Some previews' emails link to production.** `scripts/cloudflare.ts` sets each
  preview deployment's `SITE_URL` to its branch's Preview URL, worked out from the branch name.
  It can't for a branch whose name Cloudflare shortens with a hash (when
  `<branch>-<worker>` is over 63 characters) or when `SITE_URL` isn't on workers.dev; those
  keep production's `SITE_URL`. Change it in the Convex dashboard to test their emails.
- **Changing the workers.dev subdomain leaves old URLs in Convex.** Run `bun run convex:auth env`
  with `--prod` and with `--preview` and the new URL. A preview deployment that already
  exists keeps its old `SITE_URL`; set it with
  `bunx convex env set SITE_URL <url> --preview-name <branch>` in packages/backend.
- **The auth pages were checked by hand in one browser, not automated.** Sign-up, verification,
  sign-in, password reset, and signing out in one tab or another all work on port 3000. Nobody
  has yet checked that an emailed link fails when opened in a second browser.
- **A used link and a link opened in another browser get the same message.** The beta's hooks
  remove the browser's secret once a link works, so both come back as `MISSING_SECRET`, and
  `authErrorMessage` names both causes.
- **Whether an email has an account can still be found out.** Forgot-password shows the same
  page for an unknown email, but `startPasswordRecovery` still returns `EMAIL_NOT_FOUND`, which
  anyone can see in the response, and sign-up says `EMAIL_TAKEN`. The beta accepts this and
  limits the lookups per IP. Closing it needs the beta to answer unknown emails like known ones.
