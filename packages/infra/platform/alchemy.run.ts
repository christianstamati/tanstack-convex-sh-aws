// Everything stateful and shared in one account. App stages hold no data and read these outputs
// with `stackRef("TcsPlatform", { stage })`, so destroying a stage never touches this stack.
//   bun run --cwd packages/infra platform --stage dev --profile tcs-dev
import * as Alchemy from "alchemy";
import * as AWS from "alchemy/AWS";
import * as Effect from "effect/Effect";
import * as Output from "alchemy/Output";
import { currentPlane, NAT_AMI, REGION, REPOSITORY, REPOSITORY_IDS } from "../lib/plane.ts";

const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name}. It is kept in SSM under /tcs/<stage>/router/.`);
  return value;
};

const GITHUB_OIDC = "token.actions.githubusercontent.com";

// Forwards private traffic to the internet. The instance also serves as the bastion, through
// Session Manager: `aws ssm start-session` needs no SSH key and no open port.
const NAT_USER_DATA = `#!/bin/bash
set -euxo pipefail
# dnf runs out of memory on a t4g.nano's 512 MB without swap.
dd if=/dev/zero of=/swapfile bs=1M count=1024
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
dnf install -y iptables-services
echo 'net.ipv4.ip_forward=1' > /etc/sysctl.d/90-nat.conf
sysctl --system
interface=$(ip route show default | awk '{print $5; exit}')
iptables -t nat -A POSTROUTING -o "$interface" -j MASQUERADE
iptables -F FORWARD
service iptables save
systemctl enable --now iptables
`;

export default Alchemy.Stack(
  "TcsPlatform",
  { providers: AWS.providers(), state: AWS.state() },
  Effect.gen(function* () {
    const plane = yield* currentPlane;
    const originSecret = required("ORIGIN_SECRET");
    const previewPassword = plane.protected ? undefined : required("PREVIEW_BASIC_PASSWORD");
    const tags = { plane: plane.name };

    const network = yield* AWS.EC2.Network("Network", {
      cidrBlock: plane.cidrBlock,
      availabilityZones: 2,
      gatewayEndpoints: ["s3"],
      tags,
    });

    // NAT instance: one is enough, as the Network shares a private route table across its AZs.
    const natGroup = yield* AWS.EC2.SecurityGroup("NatSecurityGroup", {
      vpcId: network.vpcId,
      description: "NAT instance: everything from inside the VPC",
      ingress: [{ ipProtocol: "-1", cidrIpv4: plane.cidrBlock, description: "VPC" }],
      tags,
    });
    const natRole = yield* AWS.IAM.Role("NatRole", {
      assumeRolePolicyDocument: {
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: { Service: "ec2.amazonaws.com" },
            Action: ["sts:AssumeRole"],
          },
        ],
      },
      managedPolicyArns: ["arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"],
      tags,
    });
    const natProfile = yield* AWS.IAM.InstanceProfile("NatProfile", {
      roleName: natRole.roleName,
      tags,
    });
    const nat = yield* AWS.EC2.Instance("Nat", {
      imageId: NAT_AMI,
      instanceType: "t4g.nano",
      subnetId: network.publicSubnetIds[0],
      securityGroupIds: [natGroup.groupId],
      instanceProfileName: natProfile.instanceProfileName,
      associatePublicIpAddress: true,
      sourceDestCheck: false,
      userData: NAT_USER_DATA,
      tags,
    });
    yield* AWS.EC2.Route("PrivateDefaultRoute", {
      routeTableId: network.privateRouteTables[0].routeTableId,
      destinationCidrBlock: "0.0.0.0/0",
      instanceId: nat.instanceId,
    });

    const albGroup = yield* AWS.EC2.SecurityGroup("AlbSecurityGroup", {
      vpcId: network.vpcId,
      description: "ALB: HTTP and HTTPS from anywhere",
      ingress: [
        { ipProtocol: "tcp", fromPort: 80, toPort: 80, cidrIpv4: "0.0.0.0/0" },
        { ipProtocol: "tcp", fromPort: 443, toPort: 443, cidrIpv4: "0.0.0.0/0" },
      ],
      tags,
    });
    const backendGroup = yield* AWS.EC2.SecurityGroup("BackendSecurityGroup", {
      vpcId: network.vpcId,
      description: "Convex backend: API and HTTP actions from the ALB",
      ingress: [
        {
          ipProtocol: "tcp",
          fromPort: 3210,
          toPort: 3211,
          referencedGroupId: albGroup.groupId,
          description: "ALB",
        },
      ],
      tags,
    });
    const databaseGroup = yield* AWS.EC2.SecurityGroup("DatabaseSecurityGroup", {
      vpcId: network.vpcId,
      description: "Postgres: from the backend and the bastion",
      ingress: [
        {
          ipProtocol: "tcp",
          fromPort: 5432,
          toPort: 5432,
          referencedGroupId: backendGroup.groupId,
          description: "Convex backend",
        },
        {
          ipProtocol: "tcp",
          fromPort: 5432,
          toPort: 5432,
          referencedGroupId: natGroup.groupId,
          description: "Bastion",
        },
      ],
      tags,
    });

    const albCertificate = yield* AWS.ACM.Certificate("AlbCertificate", {
      domainName: `*.${plane.zone}`,
      region: REGION,
      tags,
    });
    const alb = yield* AWS.ELBv2.LoadBalancer("Alb", {
      subnets: network.publicSubnetIds,
      securityGroups: [albGroup.groupId],
      // Convex clients hold a websocket open.
      attributes: {
        "idle_timeout.timeout_seconds": "300",
        "routing.http.drop_invalid_header_fields.enabled": "true",
      },
      tags,
    });
    yield* AWS.ELBv2.Listener("HttpListener", {
      loadBalancerArn: alb.loadBalancerArn,
      port: 80,
      protocol: "HTTP",
      defaultActions: [
        { type: "redirect", statusCode: "HTTP_301", protocol: "HTTPS", port: "443" },
      ],
    });
    // App stages add a host rule per hostname.
    const httpsListener = yield* AWS.ELBv2.Listener("HttpsListener", {
      loadBalancerArn: alb.loadBalancerArn,
      port: 443,
      protocol: "HTTPS",
      certificateArn: albCertificate.certificateArn,
      sslPolicy: "ELBSecurityPolicy-TLS13-1-2-2021-06",
      defaultActions: [{ type: "fixedResponse", statusCode: "404", contentType: "text/plain" }],
    });

    const cluster = yield* AWS.ECS.Cluster("Cluster", { tags });

    const databaseSubnets = yield* AWS.RDS.DBSubnetGroup("DatabaseSubnets", {
      description: "Private subnets",
      subnetIds: network.privateSubnetIds,
      tags,
    });
    const database = yield* AWS.RDS.DBInstance("Database", {
      engine: "postgres",
      engineVersion: "17.6",
      dbInstanceClass: "db.t4g.micro",
      allocatedStorage: 20,
      storageType: "gp3",
      storageEncrypted: true,
      masterUsername: "convex_admin",
      manageMasterUserPassword: true,
      dbSubnetGroupName: databaseSubnets.dbSubnetGroupName,
      vpcSecurityGroupIds: [databaseGroup.groupId],
      publiclyAccessible: false,
      multiAZ: false,
      backupRetentionPeriod: plane.protected ? "7 days" : "1 day",
      deletionProtection: plane.protected,
      skipFinalSnapshot: !plane.protected,
      tags,
    }).pipe(Alchemy.RemovalPolicy.retain(plane.protected));

    // Convex's five buckets. A Preview stage is limited to its own prefix in them.
    const bucket = (id: string, name: string, versioned: boolean) =>
      AWS.S3.Bucket(id, {
        bucketName: `tcs-${plane.name}-${name}-${plane.accountId}`,
        forceDestroy: !plane.protected,
        versioning: plane.protected && versioned ? "Enabled" : undefined,
        tags,
      }).pipe(Alchemy.RemovalPolicy.retain(plane.protected));
    const filesBucket = yield* bucket("FilesBucket", "files", true);
    const modulesBucket = yield* bucket("ModulesBucket", "modules", true);
    const exportsBucket = yield* bucket("ExportsBucket", "exports", false);
    const importsBucket = yield* bucket("ImportsBucket", "imports", false);
    const searchBucket = yield* bucket("SearchBucket", "search", false);

    // Runs first in the viewer-request function: Basic Auth on previews, then the secret that
    // server.ts requires, since the Lambda's Function URL is public.
    const basicAuth = previewPassword
      ? `Basic ${Buffer.from(`preview:${previewPassword}`).toString("base64")}`
      : undefined;
    const injection = `
      ${
        basicAuth
          ? `var authorization = event.request.headers.authorization;
      if (!authorization || authorization.value !== ${JSON.stringify(basicAuth)}) {
        return {
          statusCode: 401,
          statusDescription: "Unauthorized",
          headers: {
            "www-authenticate": { value: 'Basic realm="preview"' },
            "cache-control": { value: "no-store" },
          },
        };
      }`
          : ""
      }
      event.request.headers["x-origin-secret"] = { value: ${JSON.stringify(originSecret)} };
    `;
    const routerDomain = plane.protected ? plane.zone : `*.${plane.zone}`;
    // Our own, as the Router sends ACM an empty SAN list for a domain with no aliases.
    const routerCertificate = yield* AWS.ACM.Certificate("RouterCertificate", {
      domainName: routerDomain,
      tags,
    });
    const router = yield* AWS.Website.Router("Router", {
      domain: { name: routerDomain, cert: routerCertificate.certificateArn },
      edge: { viewerRequest: { injection } },
      tags,
    });
    yield* AWS.SSM.Parameter("OriginSecret", {
      name: `/tcs/${plane.name}/router/origin-secret`,
      type: "SecureString",
      value: originSecret,
      tags,
    });
    if (previewPassword) {
      yield* AWS.SSM.Parameter("PreviewPassword", {
        name: `/tcs/${plane.name}/router/preview-password`,
        type: "SecureString",
        value: previewPassword,
        tags,
      });
    }

    // GitHub Actions gets this account only from a job in the plane's GitHub Environment.
    const oidc = yield* AWS.IAM.OpenIDConnectProvider("GitHubOidc", {
      url: `https://${GITHUB_OIDC}`,
      clientIDList: ["sts.amazonaws.com"],
      tags,
    });
    const ciRole = yield* AWS.IAM.Role("CiRole", {
      roleName: plane.ciRole,
      assumeRolePolicyDocument: {
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: { Federated: oidc.openIDConnectProviderArn },
            Action: ["sts:AssumeRoleWithWebIdentity"],
            Condition: {
              StringEquals: {
                [`${GITHUB_OIDC}:aud`]: "sts.amazonaws.com",
                [`${GITHUB_OIDC}:sub`]: [
                  `repo:${REPOSITORY.owner}/${REPOSITORY.name}:environment:${plane.environment}`,
                  `repo:${REPOSITORY.owner}@${REPOSITORY_IDS.owner}/${REPOSITORY.name}@${REPOSITORY_IDS.name}:environment:${plane.environment}`,
                ],
              },
            },
          },
        ],
      },
      inlinePolicies: {
        Deploy: {
          Version: "2012-10-17",
          Statement: [
            {
              Sid: "DeployInOurRegions",
              Effect: "Allow",
              Action: ["*"],
              Resource: "*",
              // us-east-1 is where CloudFront, IAM and Route 53 calls land.
              Condition: { StringEquals: { "aws:RequestedRegion": [REGION, "us-east-1"] } },
            },
            {
              Sid: "NeverEditTheKeysToTheHouse",
              Effect: "Deny",
              Action: ["iam:*"],
              Resource: [
                `arn:aws:iam::${plane.accountId}:role/${plane.ciRole}`,
                `arn:aws:iam::${plane.accountId}:oidc-provider/${GITHUB_OIDC}`,
              ],
            },
          ],
        },
      },
      tags,
    });

    return {
      vpcId: network.vpcId,
      publicSubnetIds: network.publicSubnetIds,
      privateSubnetIds: network.privateSubnetIds,
      backendSecurityGroupId: backendGroup.groupId,
      clusterArn: cluster.clusterArn,
      httpsListenerArn: httpsListener.listenerArn,
      albDnsName: alb.dnsName,
      albHostedZoneId: alb.canonicalHostedZoneId,
      databaseHost: database.endpointAddress,
      databaseSecretArn: database.masterUserSecretArn,
      buckets: {
        files: filesBucket.bucketName,
        modules: modulesBucket.bucketName,
        exports: exportsBucket.bucketName,
        imports: importsBucket.bucketName,
        search: searchBucket.bucketName,
      },
      router: {
        kvStoreArn: router.kvStoreArn,
        kvNamespace: router.kvNamespace,
        distributionId: router.distributionId,
        distributionArn: router.distributionArn,
        url: router.url,
      },
      ciRoleArn: ciRole.roleArn,
      natInstanceId: Output.interpolate`${nat.instanceId}`,
    };
  }),
);
