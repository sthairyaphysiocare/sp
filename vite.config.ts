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
  // No nitro.cloudflare overrides — restored to this repo's default after
  // deployConfig: false was tried and reverted on this branch. Removing that
  // generated wrangler.json changed how Cloudflare Pages handles the worker
  // output in some way (the exact mechanism is unconfirmed), which is worth
  // keeping in mind, but it turned out to be unrelated to the actual bug
  // below — that bug is present in the JS output itself, identically,
  // whether this file exists or not.
  vite: {
    build: {
      rollupOptions: {
        // Works around a live Rolldown bug (the Rust-based bundler behind
        // Vite 8's build step; "rollupOptions" is Vite's long-standing
        // config key, kept for compatibility even though Rolldown replaced
        // Rollup under the hood). In some code-split builds, Rolldown may
        // place its own runtime helpers (__exportAll and friends) inside a
        // chunk that ends up in a circular import with another chunk that
        // needs them, leaving the helper undefined at the moment it's first
        // called — see rolldown/rolldown#8809 (closed; a related, still
        // maybe-live issue) and rolldown/rolldown#8184, whose own report
        // states "Disabling chunkOptimization works around the issue".
        //
        // Confirmed directly on a live Cloudflare Pages preview deployment:
        // "TypeError: __exportAll is not a function" inside this app's SSR
        // chunk, identically across multiple deploys and independent of
        // every Cloudflare-side setting tried — pointing at the build output
        // itself, not deploy configuration, as the actual cause.
        //
        // This app's SSR build is exactly the shape that provokes it: dozens
        // of route chunks plus many shared library chunks. Disabling this
        // optimization produces slightly less consolidated chunks in
        // exchange for correct cross-chunk loading — a good trade until
        // upstream ships a fix.
        experimental: {
          chunkOptimization: false,
        },
      },
    },
  },
});
