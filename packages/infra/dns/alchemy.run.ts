// The hosted zone of each account, deployed before the platform stack: its certificates can only
// validate once the zone answers publicly. Prod owns the apex and delegates preview. to dev.
//   bun run --cwd packages/infra dns --stage dev --profile tcs-dev
import * as Alchemy from "alchemy";
import * as AWS from "alchemy/AWS";
import * as Effect from "effect/Effect";
import { currentPlane, PREVIEW_ZONE } from "../lib/plane.ts";

// The name servers of the dev zone, printed by its deploy. Prod delegates preview. to them.
const PREVIEW_NAME_SERVERS = [
  "ns-177.awsdns-22.com",
  "ns-989.awsdns-59.net",
  "ns-1497.awsdns-59.org",
  "ns-1600.awsdns-08.co.uk",
];

export default Alchemy.Stack(
  "TcsDns",
  { providers: AWS.providers(), state: AWS.state() },
  Effect.gen(function* () {
    const plane = yield* currentPlane;
    const zone = yield* AWS.Route53.HostedZone("Zone", { name: plane.zone }).pipe(
      Alchemy.RemovalPolicy.retain(plane.protected),
    );
    if (plane.name === "prod") {
      yield* AWS.Route53.Record("PreviewDelegation", {
        hostedZoneId: zone.id,
        name: PREVIEW_ZONE,
        type: "NS",
        ttl: "1 hour",
        records: PREVIEW_NAME_SERVERS,
      });
    }
    return { hostedZoneId: zone.id, nameServers: zone.nameServers };
  }),
);
