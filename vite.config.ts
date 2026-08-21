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
      // Stops Nitro writing its own wrangler.json into the build output.
      //
      // Two things this project has now hit rule out patching that generated
      // file instead of removing it. First, Cloudflare's own Pages docs state
      // the file "becomes the source of truth... you can not edit the same
      // fields in the dashboard once you are using this file" — so once any
      // config file is present, dashboard settings for whatever it touches
      // stop applying, which fits the repeated secrets loss. Second, Pages'
      // accepted schema is narrower than plain Workers': keep_vars, the one
      // documented Workers-side fix for this exact problem, was tried and
      // rejected outright by Cloudflare's own validation ("Configuration file
      // for Pages projects does not support keep_vars"), which also means I
      // can't be confident about the rest of that schema either.
      //
      // Removing the file sidesteps both problems at once: with nothing
      // present, dashboard settings are unambiguously authoritative again —
      // the same arrangement that ran without incident before any of this
      // started.
      //
      // Required alongside this: nodejs_compat and a recent compatibility
      // date must be set directly in the Cloudflare Pages dashboard
      // (Settings -> Functions -> Compatibility flags), for both Production
      // and Preview — this file was the only thing supplying those.
      //
      // The Worker script itself (_worker.js) is unaffected — this only
      // removes the accompanying config file. Verified locally: SSR output is
      // identical with this on or off; only the generated wrangler.json
      // disappears.
      deployConfig: false,
    },
  },
});
