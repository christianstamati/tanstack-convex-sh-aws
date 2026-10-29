import { defineConfig } from "cf/config";

// The Worker's configuration, read by the Cloudflare Vite plugin and the `cf` CLI. The build
// writes the Worker to .cloudflare/output/, which `cf deploy --prebuilt` and
// `cf previews deploy --prebuilt` upload.
export default defineConfig({
  worker: {
    name: "tanstack-convex-sh-aws",
    compatibilityDate: "2026-10-19",
    compatibilityFlags: ["nodejs_compat"],
    // Answers /health and the /auth routes, and passes the session to TanStack Start's server entry.
    entrypoint: "src/server.ts",
    // Production is served at tanstack-convex-sh-aws.<subdomain>.workers.dev; branches get Preview URLs.
    workersDev: true,
    previewUrls: true,
    observability: { enabled: true },
  },
});
