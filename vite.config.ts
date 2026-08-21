// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  // No nitro.cloudflare overrides here. deployConfig: false was tried on this
  // branch and reverted: the generated wrangler.json this repo relies on
  // Nitro to produce carries more than compatibility settings — it also sets
  // `no_bundle: true` and explicit rules describing how the many small .mjs
  // chunks under _worker.js should be loaded. Without that file, Cloudflare
  // falls back to different assumptions about the output and the SSR chunk
  // failed to resolve a cross-chunk export helper at runtime
  // ("__exportAll is not a function") — confirmed directly via a live
  // preview deployment's own error output.
  //
  // Compatibility flags and date are handled separately now: set directly in
  // the Cloudflare Pages dashboard (Settings -> Functions), for both
  // Production and Preview, alongside whatever this generated file supplies —
  // redundant, but harmless, and it's what actually resolved the previous
  // "node:async_hooks" failure on this same branch.
});
