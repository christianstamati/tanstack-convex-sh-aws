// Runs inside the VPC, where it can reach Postgres, and is the only thing that ever holds the
// master password. For each stage it creates a database, a role that owns it and the stage's
// secrets in SSM, or removes all of them, along with the stage's prefix in the shared buckets.
import { randomBytes } from "node:crypto";
import { DeleteObjectsCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import {
  DeleteParameterCommand,
  GetParameterCommand,
  ParameterNotFound,
  PutParameterCommand,
  SSMClient,
} from "@aws-sdk/client-ssm";
import postgres from "postgres";
import { RDS_CA_BUNDLE } from "../lib/rds-ca.ts";

const DATABASE = /^tcs_[a-z0-9_]+$/;
const STAGE = /^[a-z0-9-]+$/;

const ssm = new SSMClient({});

type Event = { action: "create" | "delete"; stage: string; instanceName: string; database: string };

export async function handler(event: Event) {
  const { action, stage, instanceName, database } = event;
  if (!STAGE.test(stage) || !DATABASE.test(database)) throw new Error("Bad stage or database.");
  const sql = await connect();
  try {
    if (action === "create") await create(sql, event);
    else if (action === "delete") await remove(sql, stage, instanceName, database);
    else throw new Error("Unknown action.");
  } finally {
    await sql.end();
  }
  return { ok: true };
}

async function connect() {
  const { SecretString } = await new SecretsManagerClient({}).send(
    new GetSecretValueCommand({ SecretId: process.env.MASTER_SECRET_ARN }),
  );
  const { username, password } = JSON.parse(SecretString!);
  return postgres({
    host: process.env.DATABASE_HOST,
    port: 5432,
    database: "postgres",
    username,
    password,
    ssl: { ca: RDS_CA_BUNDLE, rejectUnauthorized: true },
    max: 1,
  });
}

const parameter = (stage: string, name: string) => `/tcs/${stage}/convex/${name}`;

async function create(sql: postgres.Sql, { stage, database }: Event) {
  const urlName = parameter(stage, "postgres-url");
  // Both are made once: a new instance secret would invalidate the stage's admin keys.
  await putOnce(parameter(stage, "instance-secret"), () => randomBytes(32).toString("hex"));
  await putOnce(urlName, () => {
    const password = randomBytes(24).toString("hex");
    return `postgresql://${database}:${password}@${process.env.DATABASE_HOST}:5432`;
  });
  const url = new URL((await get(urlName))!);

  const [role] = await sql`SELECT 1 FROM pg_roles WHERE rolname = ${database}`;
  // CREATE ROLE takes no parameters. The password is our own hex, and the database name was checked.
  const secret = `'${url.password}'`;
  await sql.unsafe(
    role
      ? `ALTER ROLE "${database}" LOGIN PASSWORD ${secret}`
      : `CREATE ROLE "${database}" LOGIN PASSWORD ${secret}`,
  );
  // The master user isn't a superuser: it must be a member of a role to give it a database.
  await sql.unsafe(`GRANT "${database}" TO CURRENT_USER`);
  const [existing] = await sql`SELECT 1 FROM pg_database WHERE datname = ${database}`;
  if (!existing) await sql.unsafe(`CREATE DATABASE "${database}" OWNER "${database}"`);
}

async function remove(sql: postgres.Sql, stage: string, instanceName: string, database: string) {
  if (stage === "prod") throw new Error("The provisioner never deletes prod.");
  await sql.unsafe(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
  await sql.unsafe(`DROP ROLE IF EXISTS "${database}"`);
  await Promise.all(
    ["postgres-url", "instance-secret", "admin-key"].map((name) =>
      ssm.send(new DeleteParameterCommand({ Name: parameter(stage, name) })).catch((error) => {
        if (!(error instanceof ParameterNotFound)) throw error;
      }),
    ),
  );
  await Promise.all(
    process.env.BUCKETS!.split(",").map((bucket) => emptyPrefix(bucket, instanceName)),
  );
}

/** Convex keeps a stage's objects under `<instance>-<uuid>/`. */
async function emptyPrefix(bucket: string, instanceName: string) {
  const s3 = new S3Client({});
  const ours = new RegExp(`^${instanceName}-[0-9a-f]{8}-[0-9a-f-]{27}/`);
  let token: string | undefined;
  do {
    const page = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: `${instanceName}-`,
        ContinuationToken: token,
      }),
    );
    const keys = (page.Contents ?? []).filter(({ Key }) => ours.test(Key!));
    if (keys.length > 0) {
      await s3.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: keys.map(({ Key }) => ({ Key })) },
        }),
      );
    }
    token = page.NextContinuationToken;
  } while (token);
}

async function get(name: string) {
  try {
    const result = await ssm.send(new GetParameterCommand({ Name: name, WithDecryption: true }));
    return result.Parameter?.Value;
  } catch (error) {
    if (error instanceof ParameterNotFound) return undefined;
    throw error;
  }
}

async function putOnce(name: string, value: () => string) {
  if ((await get(name)) !== undefined) return;
  await ssm.send(new PutParameterCommand({ Name: name, Type: "SecureString", Value: value() }));
}
