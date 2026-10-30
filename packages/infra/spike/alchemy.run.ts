// Throwaway spike: a Router with Basic Auth and an origin secret, and the web app attached to it.
// Deploy only to tanstack-dev: `bun run spike:deploy --stage spike --profile tcs-dev`.
import * as Alchemy from "alchemy";
import * as AWS from "alchemy/AWS";
import * as Effect from "effect/Effect";

const basicPassword = process.env.SPIKE_BASIC_PASSWORD;
const originSecret = process.env.SPIKE_ORIGIN_SECRET;
if (!basicPassword || !originSecret) {
  throw new Error("Set SPIKE_BASIC_PASSWORD and SPIKE_ORIGIN_SECRET.");
}
const basicAuth = `Basic ${Buffer.from(`preview:${basicPassword}`).toString("base64")}`;

// Runs at the top of the Router's CloudFront viewer-request function (cloudfront-js-2.0).
const injection = `
  var auth = event.request.headers.authorization;
  if (!auth || auth.value !== ${JSON.stringify(basicAuth)}) {
    return {
      statusCode: 401,
      statusDescription: "Unauthorized",
      headers: {
        "www-authenticate": { value: 'Basic realm="preview"' },
        "cache-control": { value: "no-store" },
      },
    };
  }
  event.request.headers["x-origin-secret"] = { value: ${JSON.stringify(originSecret)} };
`;

export default Alchemy.Stack(
  "TcsSpike",
  { providers: AWS.providers(), state: AWS.state() },
  Effect.gen(function* () {
    const router = yield* AWS.Website.Router("Router", {
      edge: { viewerRequest: { injection } },
    });

    const web = yield* AWS.Website.TanStackStart("Web", {
      rootDir: "../../apps/web",
      architecture: "arm64",
      memorySize: 2048,
      env: { ORIGIN_SECRET: originSecret },
      domain: { router },
    });

    return { routerUrl: router.url, lambdaUrl: web.serverUrl };
  }),
);
