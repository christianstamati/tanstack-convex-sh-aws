# Alchemy v2 spike: findings

Run on 2026-10-30 in tanstack-dev (723732457117), eu-central-1, with `alchemy@2.0.0-beta.83`,
`@alchemy.run/frontend-frameworks@2.0.0-beta.83` and `effect@4.0.5`. Everything it created
has been deleted, except Alchemy's state and assets buckets, which real deploys need too.

## Answers

| #   | Question                                               | Answer                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | One CloudFront router for many stages, with Basic Auth | **Yes.** `AWS.Website.Router` is one distribution that routes by host and path from a KeyValueStore. `edge.viewerRequest.injection` runs first: Basic Auth returned 401 without credentials. A site in another stack attaches with `domain: { name, router }` given the Router's `kvStoreArn`, `kvNamespace`, `distributionId`, `distributionArn` and `url`; it then only writes KV routes, so the Router must own the wildcard certificate, alias and DNS record. Host routing on a real wildcard domain is still untested (needs the DNS switch). |
| 2   | RDS Postgres instance resource                         | **Yes.** `AWS.RDS.DBInstance`, with `DBSubnetGroup`. Set `storageEncrypted`, `deletionProtection` and `skipFinalSnapshot: false` explicitly: destroy skips the final snapshot by default.                                                                                                                                                                                                                                                                                                                                                           |
| 3   | Create and drop each preview's database                | **Custom resource.** `Action` and `Command.Exec` never run on delete. A small `Resource` + `Provider.effect` with `reconcile` and `delete` (template: `AWS/SSM/Parameter.ts`) that invokes the provisioner Lambda in the VPC.                                                                                                                                                                                                                                                                                                                       |
| 4   | Our `server.ts` on Lambda                              | **Yes, unchanged.** The integration runs our own `vite build` and wraps `dist/server/server.js`'s `default.fetch` as a streaming Lambda. SSR, `/health` and the `/auth/*` POSTs all reached it. Requires removing `@cloudflare/vite-plugin` from `vite.config.ts`.                                                                                                                                                                                                                                                                                  |
| 5   | `/auth` POSTs through CloudFront                       | **No problem, but no OAC either.** Alchemy gives the Lambda a public Function URL (`authType: NONE`), so there is no body signing to worry about, and anyone with the URL could skip CloudFront and Basic Auth. Fixed with an origin secret: the Router adds `x-origin-secret`, and `server.ts` answers 403 without it (verified: direct URL → 403, through CloudFront → handler).                                                                                                                                                                  |
| 6   | Convex backend on RDS over TLS                         | **Yes, with `PG_CA_FILE`.** Without it the backend fails with `invalid peer certificate: UnknownIssuer`. Mounting AWS's RDS bundle (`truststore.pki.rds.amazonaws.com/eu-central-1/eu-central-1-bundle.pem`) as `PG_CA_FILE` gives verified TLS; a full `convex deploy` and a query worked. Bake the bundle into the task (or fetch it at start). `MYSQL_CA_FILE` exists too.                                                                                                                                                                       |

## Gotchas for the real stacks

- **Credentials:** `AWS_PROFILE` is ignored. Each machine runs once:
  `alchemy profile create tcs-dev` then
  `alchemy profile edit --profile tcs-dev --add AWS --method sso --set ssoProfile=tcs-dev`,
  and deploys with `--profile tcs-dev`. CI uses `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`/`AWS_SESSION_TOKEN`/`AWS_REGION` from OIDC.
- **Bootstrap once per account:** `alchemy provider aws bootstrap --aws-profile <profile> --region eu-central-1` (assets bucket for Lambda zips). State goes to `alchemy-state-<account>-eu-central-1-an`, created on first use.
- **Effect versions:** `@effect/platform-bun@4.0.5` pulls `@effect/platform-node-shared@4.1.0`, which needs `effect@4.1.0`. Root `overrides` pin the family to one version.
- **First deploy in a fresh account is flaky:** a race created the CloudFront Function before its KeyValueStore was provisioned, and the account-specific `<account>.cloudfront-kvs.global.api.aws` endpoint was not in DNS yet; macOS then cached the miss for ~13 minutes. Re-running `deploy` resumes. CI runners won't have the cached miss.
- **Image path:** the Convex backend image is `ghcr.io/convex/convex-backend`, not `ghcr.io/get-convex/...`.
- The CLI warns that beta.84 is out; it was 6 days old, so the spike stayed on beta.83.

## Found while deploying the dev platform

- **Router certificate:** with no aliases, `AWS.Website.Router` sends ACM an empty SAN list, which fails. Pass your own certificate as `domain.cert`.
- **NAT instance:** `dnf` is killed for lack of memory on a t4g.nano, leaving cloud-init stuck and the NAT silently broken: the deploy and `alchemy plan` both look clean. The boot script adds 1 GB of swap first. Check forwarding on the instance, not the deploy log.
- **`--env-file`** doesn't reach `process.env` in a stack file. Export the variables in the shell.
- **Secrets:** `ORIGIN_SECRET` and `PREVIEW_BASIC_PASSWORD` must be set for each platform deploy. Read them back with `aws ssm get-parameter --with-decryption --name /tcs/dev/router/origin-secret`.

## Found while deploying the first stage

- **Origin check:** Convex Auth compares `Origin` with `Host`, and behind CloudFront `Host` is the Lambda's URL, so every sign-in got 403 `{"tokens":null}`. `server.ts` now passes `allowedOrigins` from `SITE_ORIGIN`.
- **Basic Auth:** the auth proxy forwards `Authorization` to Convex, which answers `InvalidAdminKey`. The Router deletes the header once Basic Auth has passed.
- **Design change:** `scripts/stage.ts` replaces the custom resource from the spike. It runs the provisioner, `alchemy deploy`, then `convex deploy`, and keeps database passwords out of Alchemy state.
- **Tests:** `/health` can't catch either auth bug. Only a real sign-up through CloudFront did.
