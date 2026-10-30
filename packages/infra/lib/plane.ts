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

export const planes = {
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

/** A stage's name becomes a hostname label, a database name and a resource prefix. */
const STAGE_NAME = /^(pr-[1-9][0-9]*|dev-[a-z0-9]+(-[a-z0-9]+)*)$/;

/** What a stage's name decides: its plane, hostnames and ALB rule priority. */
export function stageInfo(stage: string) {
  if (stage !== "prod" && !(STAGE_NAME.test(stage) && stage.length <= 24)) {
    throw new Error(
      `Bad stage name "${stage}": use prod, pr-<n> or dev-<user>, 24 characters at most.`,
    );
  }
  if (/-(cloud|site)$/.test(stage)) {
    throw new Error(`Bad stage name "${stage}": it would collide with a stage's Convex hostnames.`);
  }
  const prod = stage === "prod";
  const plane: Plane = prod ? planes.prod : planes.dev;
  return {
    stage,
    plane,
    // Prefixes admin keys. Its database and role replace the hyphens with underscores.
    instanceName: `tcs-${stage}`,
    database: `tcs_${stage.replaceAll("-", "_")}`,
    hosts: prod
      ? { web: DOMAIN, cloud: `cloud.${DOMAIN}`, site: `site.${DOMAIN}` }
      : {
          web: `${stage}.${PREVIEW_ZONE}`,
          cloud: `${stage}-cloud.${PREVIEW_ZONE}`,
          site: `${stage}-site.${PREVIEW_ZONE}`,
        },
    // Each stage takes two listener rules: this priority and the next.
    priority: prod ? 100 : rulePriority(stage),
    size: prod ? { cpu: 1024, memory: 2048 } : { cpu: 512, memory: 1024 },
  };
}

function rulePriority(stage: string) {
  const pullRequest = /^pr-([0-9]+)$/.exec(stage);
  if (pullRequest) return 10000 + 2 * Number(pullRequest[1]);
  let hash = 5381;
  for (const character of stage) hash = (hash * 33 + character.charCodeAt(0)) % 2 ** 32;
  return 30000 + 2 * (hash % 9000);
}

/** The stage of `--stage`, refusing the wrong account. CI is the only way to deploy prod. */
export const currentStage = Effect.gen(function* () {
  const info = stageInfo(yield* Stage);
  const { accountId } = yield* AWSEnvironment.current;
  if (accountId !== info.plane.accountId) {
    return yield* Effect.die(
      `Stage ${info.stage} belongs to account ${info.plane.accountId}, but these credentials are ${accountId}.`,
    );
  }
  if (info.plane.protected && !process.env.CI && process.env.BREAK_GLASS !== "1") {
    return yield* Effect.die("Stage prod deploys from CI. Set BREAK_GLASS=1 to override.");
  }
  return info;
});

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
