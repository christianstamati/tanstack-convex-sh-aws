// The Worker, and in development the server entry of `bun run dev`. It answers the /auth routes,
// reads the session from the cookies, and renders every other path with TanStack Start, as the
// user. Convex Auth keeps the refresh token in an httpOnly cookie on this origin; the browser only
// holds the access token, which expires after a minute.
import { httpCookies, ServerAuthSession, setupConvexAuthServer } from "@convex-dev/auth/ssr";
import handler from "@tanstack/react-start/server-entry";
import { ConvexHttpClient } from "convex/browser";
import { api } from "#/lib/api";

const convexUrl = import.meta.env.VITE_CONVEX_URL;
const convex = new ConvexHttpClient(convexUrl);

export default {
  async fetch(request: Request) {
    const url = new URL(request.url);
    // `Secure` when the browser came over HTTPS. `bun run dev` serves plain HTTP.
    const cookieOptions = { secure: url.protocol === "https:" };
    if (request.method === "GET" && url.pathname === "/health") return health();
    if (request.method === "POST") {
      const auth = setupConvexAuthServer({
        convexUrl,
        refreshSession: api.auth.refreshSession,
        signOut: api.auth.signOut,
        // Every function that starts a session. The browser calls the others on Convex directly.
        signIn: [
          api.auth.signInWithEmailPassword,
          api.auth.completeSignUp,
          api.auth.completePasswordRecovery,
        ],
        cookieOptions,
      });
      switch (url.pathname) {
        case "/auth/signin":
          return auth.convexProxyHandler(request);
        case "/auth/refresh":
          return auth.refreshHandler(request);
        case "/auth/signout":
          return auth.signOutHandler(request);
      }
    }
    // Refreshes the access token when it is about to expire, which rotates both cookies.
    const cookies = httpCookies(request);
    const session = new ServerAuthSession({
      refreshSession: (refreshToken) => convex.mutation(api.auth.refreshSession, { refreshToken }),
      cookies,
      cookieOptions,
    });
    const token = await session.getToken();
    const page = await handler.fetch(request, { context: { token } });
    const headers = new Headers(page.headers);
    cookies.applyTo(headers);
    return new Response(page.body, { status: page.status, headers });
  },
};

/**
 * For uptime monitors: 200 while the Worker runs and Convex answers, 503 when Convex doesn't.
 * It asks the deployment's `/version`, which every Convex backend serves without running a
 * function, so a check costs no function calls.
 */
async function health(): Promise<Response> {
  const convexUp = await fetch(new URL("/version", convexUrl), {
    signal: AbortSignal.timeout(3000),
  }).then(
    (response) => response.ok,
    () => false,
  );
  return Response.json(
    { status: convexUp ? "ok" : "degraded", convex: convexUp ? "up" : "unreachable" },
    { status: convexUp ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
