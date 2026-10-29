import auth from "@convex-dev/auth/convex.config";
import authEmail from "@convex-dev/auth/components/email/convex.config";
import authPassword from "@convex-dev/auth/components/password/convex.config";
import rateLimiter from "@convex-dev/rate-limiter/convex.config";
import resend from "@convex-dev/resend/convex.config";
import { defineApp } from "convex/server";
import { v } from "convex/values";

// A push fails while a required variable is missing on the deployment. `bun run setup` sets them
// on the dev deployment, and `bun run convex:auth env` on production and previews.
const app = defineApp({
  env: {
    // Convex Auth's key pair, which signs the access tokens.
    AUTH_PRIVATE_KEY: v.string(),
    AUTH_JWKS: v.string(),
    // The web app's origin, such as http://localhost:3000. The links in auth emails point at it.
    SITE_URL: v.string(),
    // Without a key, auth emails go to the Convex logs instead of the inbox.
    RESEND_API_KEY: v.optional(v.string()),
    // The From address of auth emails, on a domain verified with Resend.
    AUTH_EMAIL_FROM: v.optional(v.string()),
  },
});

// The core serves its key set under /auth on the deployment's site URL. The browser signs in,
// refreshes and signs out through the web app's own /auth routes in apps/web/src/server.ts.
app.use(auth, {
  httpPrefix: "/auth",
  env: { AUTH_PRIVATE_KEY: app.env.AUTH_PRIVATE_KEY, AUTH_JWKS: app.env.AUTH_JWKS },
});
app.use(authEmail);
app.use(authPassword);
app.use(resend);
// The app's own rate limits, in convex/lib/rateLimits.ts. Convex Auth limits sign-in attempts
// and auth emails in its own components.
app.use(rateLimiter);

export default app;
