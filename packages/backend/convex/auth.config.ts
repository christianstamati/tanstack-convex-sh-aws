import type { AuthConfig } from "convex/server";
import { env } from "./_generated/server";

// Convex Auth signs access tokens for the issuer CONVEX_SITE_URL and the audience "convex", and
// serves its key set under the /auth mount of convex.config.ts.
export default {
  providers: [
    {
      type: "customJwt",
      applicationID: "convex",
      issuer: env.CONVEX_SITE_URL,
      jwks: `${env.CONVEX_SITE_URL}/auth/.well-known/jwks.json`,
      algorithm: "RS256",
    },
  ],
} satisfies AuthConfig;
