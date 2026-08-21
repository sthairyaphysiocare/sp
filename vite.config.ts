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
  nitro: {
    cloudflare: {
      // Stops Nitro from writing its own wrangler.json into the build output on
      // every build. Cloudflare Pages reads that generated file during deploy,
      // and per Cloudflare's own documented behaviour, deploying with a Wrangler
      // config present overrides dashboard-set environment variables unless the
      // config explicitly opts out with keep_vars — which this wrapper's
      // generated file does not set, and does not expose a way to add. That is
      // what has been silently wiping the Turso secrets on every deploy.
      //
      // With this off, Cloudflare falls back to reading compatibility flags and
      // date from the Pages project's own dashboard settings (Settings ->
      // Functions) instead of a file shipped in the build — so those must be
      // set there directly (nodejs_compat, plus a recent compatibility date),
      // for both Production and Preview, or the worker loses that behaviour
      // instead of losing its secrets.
      //
      // The Worker script itself (_worker.js) is unaffected — this only removes
      // the accompanying config file. Verified locally: SSR output is identical
      // with this on or off; only the generated wrangler.json disappears.
      deployConfig: false,
    },
  },
});
