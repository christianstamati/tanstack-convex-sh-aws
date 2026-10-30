// The two AWS accounts this repo deploys to. A plane is the data and network of one account:
// `dev` holds every Preview stage, `prod` holds Production.
import { Stage } from "alchemy";
import { AWSEnvironment } from "alchemy/AWS";
import * as Effect from "effect/Effect";

export const REGION = "eu-central-1";
export const REPOSITORY = { owner: "christianstamati", name: "tanstack-convex-sh-aws" };
// Some GitHub OIDC tokens carry `owner@<id>/repo@<id>`, which survives a rename.
export const REPOSITORY_IDS = { owner: 48362853, name: 1438754793 };

export const DOMAIN = "fullstackaws.dev";
export const PREVIEW_ZONE = `preview.${DOMAIN}`;

// Amazon Linux 2023 arm64 in eu-central-1. Pinned so a new AMI can't replace the NAT instance.
export const NAT_AMI = "ami-09daaf2a1325a537f";

const planes = {
  dev: {
    name: "dev",
    accountId: "723732457117",
    zone: PREVIEW_ZONE,
    cidrBlock: "10.20.0.0/16",
    environment: "preview",
    ciRole: "ci-preview",
    // Previews can be rebuilt from nothing.
    protected: false,
  },
  prod: {
    name: "prod",
    accountId: "984195381073",
    zone: DOMAIN,
    cidrBlock: "10.10.0.0/16",
    environment: "production",
    ciRole: "ci-production",
    protected: true,
  },
} as const;

export type Plane = (typeof planes)[keyof typeof planes];

/** The plane of `--stage`. Refuses the wrong account, and prod outside CI without BREAK_GLASS=1. */
export const currentPlane = Effect.gen(function* () {
  const stage = yield* Stage;
  if (stage !== "dev" && stage !== "prod") {
    return yield* Effect.die(`--stage must be dev or prod, not "${stage}".`);
  }
  const plane: Plane = planes[stage];
  const { accountId } = yield* AWSEnvironment.current;
  if (accountId !== plane.accountId) {
    return yield* Effect.die(
      `Stage ${stage} belongs to account ${plane.accountId}, but these credentials are ${accountId}.`,
    );
  }
  if (plane.protected && !process.env.CI && process.env.BREAK_GLASS !== "1") {
    return yield* Effect.die("Stage prod deploys from CI. Set BREAK_GLASS=1 to override.");
  }
  return plane;
});
