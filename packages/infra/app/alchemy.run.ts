// One stage: a Convex backend on Fargate behind the shared ALB, and the web app on Lambda behind
// the shared router. It holds no data, so destroying it leaves the platform as it was. Don't run
// this directly: `scripts/stage.ts` provisions the database first and pushes the functions after.
import * as Alchemy from "alchemy";
import * as AWS from "alchemy/AWS";
import * as Output from "alchemy/Output";
import * as Effect from "effect/Effect";
import { BACKEND_IMAGE, backendEnvironment, CA_FILE, PORT } from "../lib/backend.ts";
import { currentStage, REGION } from "../lib/plane.ts";
import { RDS_CA_BUNDLE } from "../lib/rds-ca.ts";

const originSecret = process.env.ORIGIN_SECRET;
if (!originSecret) throw new Error("Set ORIGIN_SECRET. scripts/stage.ts reads it from SSM.");

interface Platform {
  vpcId: string;
  privateSubnetIds: string[];
  backendSecurityGroupId: string;
  clusterArn: string;
  httpsListenerArn: string;
  albDnsName: string;
  albHostedZoneId: string;
  buckets: Record<"files" | "modules" | "exports" | "imports" | "search", string>;
  router: {
    kvStoreArn: string;
    kvNamespace: string;
    distributionId: string;
    distributionArn: string;
    url: string;
  };
}

const assumedBy = (service: string) => ({
  Version: "2012-10-17" as const,
  Statement: [
    { Effect: "Allow" as const, Principal: { Service: service }, Action: ["sts:AssumeRole"] },
  ],
});

export default Alchemy.Stack(
  "TcsApp",
  { providers: AWS.providers(), state: AWS.state() },
  Effect.gen(function* () {
    const { stage, plane, instanceName, hosts, priority, size } = yield* currentStage;
    // Typed as its value: `Output` reads the same fields at runtime, but only declares `map`.
    const platform = (yield* Alchemy.stackRef<Platform>("TcsPlatform", {
      stage: plane.name,
    })) as unknown as Platform;
    const tags = { plane: plane.name, stage };
    const parameter = (name: string) =>
      `arn:aws:ssm:${REGION}:${plane.accountId}:parameter/tcs/${stage}/convex/${name}`;

    // Production has its buckets to itself. A Preview stage only reaches `<instance>-<uuid>/`,
    // spelled out so stage `pr-1` can't read `pr-10-...`.
    const prefix = plane.protected ? "*" : `${instanceName}-????????-????-????-????-????????????/*`;
    const bucketArn = (name: "files" | "modules" | "exports" | "imports" | "search") =>
      Output.interpolate`arn:aws:s3:::${platform.buckets[name]}` as unknown as string;
    const names = ["files", "modules", "exports", "imports", "search"] as const;
    const taskRole = yield* AWS.IAM.Role("TaskRole", {
      assumeRolePolicyDocument: assumedBy("ecs-tasks.amazonaws.com"),
      inlinePolicies: {
        Storage: {
          Version: "2012-10-17",
          Statement: [
            {
              Sid: "Objects",
              Effect: "Allow",
              Action: [
                "s3:GetObject",
                "s3:PutObject",
                "s3:DeleteObject",
                "s3:AbortMultipartUpload",
                "s3:ListMultipartUploadParts",
              ],
              Resource: names.map(
                (name) => Output.interpolate`${bucketArn(name)}/${prefix}` as unknown as string,
              ),
            },
            {
              Sid: "Buckets",
              Effect: "Allow",
              Action: ["s3:ListBucket", "s3:GetBucketLocation"],
              Resource: names.map(bucketArn),
              // IfExists: GetBucketLocation carries no prefix.
              ...(plane.protected
                ? {}
                : { Condition: { StringLikeIfExists: { "s3:prefix": prefix } } }),
            },
          ],
        },
      },
      tags,
    });
    const executionRole = yield* AWS.IAM.Role("ExecutionRole", {
      assumeRolePolicyDocument: assumedBy("ecs-tasks.amazonaws.com"),
      managedPolicyArns: ["arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"],
      inlinePolicies: {
        Secrets: {
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Action: ["ssm:GetParameters"],
              Resource: [parameter("instance-secret"), parameter("postgres-url")],
            },
          ],
        },
      },
      tags,
    });

    const environment = {
      ...backendEnvironment(size),
      INSTANCE_NAME: instanceName,
      CONVEX_CLOUD_ORIGIN: `https://${hosts.cloud}`,
      CONVEX_SITE_ORIGIN: `https://${hosts.site}`,
      AWS_REGION: REGION,
      PG_CA_FILE: CA_FILE,
      RDS_CA_BUNDLE,
      S3_STORAGE_FILES_BUCKET: platform.buckets.files,
      S3_STORAGE_MODULES_BUCKET: platform.buckets.modules,
      S3_STORAGE_EXPORTS_BUCKET: platform.buckets.exports,
      S3_STORAGE_SNAPSHOT_IMPORTS_BUCKET: platform.buckets.imports,
      S3_STORAGE_SEARCH_BUCKET: platform.buckets.search,
    };
    const task = yield* AWS.ECS.TaskDefinition("Task", {
      family: `tcs-${stage}-convex`,
      cpu: String(size.cpu),
      memory: String(size.memory),
      networkMode: "awsvpc",
      requiresCompatibilities: ["FARGATE"],
      runtimePlatform: { cpuArchitecture: "ARM64", operatingSystemFamily: "LINUX" },
      taskRoleArn: taskRole.roleArn,
      executionRoleArn: executionRole.roleArn,
      awslogs: true,
      containerDefinitions: [
        {
          name: "backend",
          image: BACKEND_IMAGE,
          essential: true,
          // The image has no CA for RDS, and a task has no file of its own to mount.
          entryPoint: ["bash", "-c"],
          command: [`printf '%s' "$RDS_CA_BUNDLE" > ${CA_FILE} && exec ./run_backend.sh`],
          portMappings: [
            { containerPort: PORT.cloud, protocol: "tcp" },
            { containerPort: PORT.site, protocol: "tcp" },
          ],
          environment: Object.entries(environment).map(([name, value]) => ({ name, value })),
          // ECS resolves these: their values never appear in the task definition.
          secrets: [
            { name: "INSTANCE_SECRET", valueFrom: parameter("instance-secret") },
            { name: "POSTGRES_URL", valueFrom: parameter("postgres-url") },
          ],
          healthCheck: {
            command: ["CMD-SHELL", `curl -f http://localhost:${PORT.cloud}/version || exit 1`],
            interval: 5,
            timeout: 4,
            retries: 3,
            startPeriod: 30,
          },
        },
      ],
      tags,
    });

    const targetGroup = (id: string, port: number, path: string, codes: string) =>
      AWS.ELBv2.TargetGroup(id, {
        vpcId: platform.vpcId,
        port,
        protocol: "HTTP",
        targetType: "ip",
        healthCheckPath: path,
        healthCheckInterval: "10 seconds",
        matcher: { HttpCode: codes },
        // One task at a time: it must let go of its database lease quickly.
        attributes: { "deregistration_delay.timeout_seconds": "10" },
        tags,
      });
    const cloudTarget = yield* targetGroup("CloudTarget", PORT.cloud, "/version", "200");
    // The site proxy answers 404 until the app defines HTTP routes.
    const siteTarget = yield* targetGroup("SiteTarget", PORT.site, "/", "200-499");
    yield* AWS.ELBv2.ListenerRule("CloudRule", {
      listenerArn: platform.httpsListenerArn as never,
      priority,
      conditions: [{ hostHeader: { values: [hosts.cloud] } }],
      actions: [
        { type: "forward", targetGroups: [{ targetGroupArn: cloudTarget.targetGroupArn }] },
      ],
      tags,
    });
    yield* AWS.ELBv2.ListenerRule("SiteRule", {
      listenerArn: platform.httpsListenerArn as never,
      priority: priority + 1,
      conditions: [{ hostHeader: { values: [hosts.site] } }],
      actions: [{ type: "forward", targetGroups: [{ targetGroupArn: siteTarget.targetGroupArn }] }],
      tags,
    });

    const service = yield* AWS.ECS.Service("Backend", {
      cluster: platform.clusterArn as never,
      task: {
        taskDefinitionArn: task.taskDefinitionArn,
        containerName: "backend",
        port: PORT.cloud,
      },
      desiredCount: 1,
      launchType: "FARGATE",
      vpcId: platform.vpcId,
      subnets: platform.privateSubnetIds,
      securityGroups: [platform.backendSecurityGroupId],
      assignPublicIp: false,
      loadBalancers: [
        {
          targetGroupArn: cloudTarget.targetGroupArn,
          containerName: "backend",
          containerPort: PORT.cloud,
        },
        {
          targetGroupArn: siteTarget.targetGroupArn,
          containerName: "backend",
          containerPort: PORT.site,
        },
      ],
      // The backend holds an exclusive lease on its database: stop the old task first.
      deploymentConfiguration: { minimumHealthyPercent: 0, maximumPercent: 100 },
      healthCheckGracePeriod: "120 seconds",
      tags,
    });

    const albAlias = (id: string, name: string) =>
      AWS.Route53.Record(id, {
        name,
        type: "A",
        aliasTarget: { hostedZoneId: platform.albHostedZoneId, dnsName: platform.albDnsName },
      });
    yield* albAlias("CloudRecord", hosts.cloud);
    yield* albAlias("SiteRecord", hosts.site);

    const web = yield* AWS.Website.TanStackStart("Web", {
      rootDir: "../../apps/web",
      architecture: "arm64",
      memorySize: 2048,
      env: { ORIGIN_SECRET: originSecret, SITE_ORIGIN: `https://${hosts.web}` },
      domain: { name: hosts.web, router: platform.router },
      forceDestroy: true,
      tags,
    });

    return {
      url: `https://${hosts.web}`,
      convexUrl: `https://${hosts.cloud}`,
      serviceArn: service.serviceArn,
      webFunction: web.server?.functionName,
    };
  }),
);
