import { defineConfig } from "vite-plus";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { convexAuth } from "@samebase/convex-auth-tanstack-start/vite";
import { lazyPlugins } from "vite-plus";

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  // Vitest unit tests live next to the code they test.
  test: { exclude: ["node_modules/**"], passWithNoTests: true },
  // Unit tests only need React; the Start, Cloudflare and devtools plugins expect a dev server or build.
  plugins: lazyPlugins(() =>
    process.env.VITEST
      ? [viteReact()]
      : [
          devtools(),
          // Resolves Convex Auth's session provider, which the beta's exports map hides.
          convexAuth(),
          tailwindcss(),
          tanstackStart(),
          viteReact(),
        ],
  ),
});

export default config;
