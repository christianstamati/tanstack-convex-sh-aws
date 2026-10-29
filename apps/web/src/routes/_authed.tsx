import {
  RedirectWithoutSession,
  redirectWithoutSession,
} from "@samebase/convex-auth-tanstack-start";
import { createFileRoute, Outlet } from "@tanstack/react-router";

// The pages under src/routes/_authed/ need a session. Without one, the visitor goes to /signin,
// which returns them here afterwards.
export const Route = createFileRoute("/_authed")({
  // On the server, which has the cookie. A block body: an expression body's return type would
  // depend on the route tree, which contains this route, and TypeScript reports the cycle.
  beforeLoad: ({ serverContext, location }) => {
    redirectWithoutSession(serverContext, { to: "/signin", search: { next: location.href } });
  },
  // Private pages stay out of search results, even if a crawler finds a link to one.
  head: () => ({ meta: [{ name: "robots", content: "noindex" }] }),
  // In the browser: on a navigation inside the app, and when the session ends in any tab.
  component: () => (
    <RedirectWithoutSession to={(next) => ({ to: "/signin", search: { next } })}>
      <Outlet />
    </RedirectWithoutSession>
  ),
});
