import { readFileSync } from "node:fs";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [
    {
      // Convex Auth's password component hashes with argon2id-wasm, which imports its .wasm file
      // as a compiled `WebAssembly.Module`, as Convex's bundler provides it. Vite doesn't.
      name: "wasm-module",
      enforce: "pre",
      load(id) {
        if (!id.endsWith(".wasm")) return;
        const base64 = readFileSync(id).toString("base64");
        return `export default new WebAssembly.Module(Uint8Array.from(atob("${base64}"), (c) => c.charCodeAt(0)));`;
      },
    },
  ],
  test: {
    // Convex functions run in an edge-like runtime; convex-test relies on it.
    environment: "edge-runtime",
    include: ["convex/**/*.test.ts"],
    // argon2id-wasm goes through Vite, so the plugin above loads its .wasm file.
    server: { deps: { inline: ["convex-test", "argon2id-wasm"] } },
  },
});
