#!/usr/bin/env node
/**
 * Patches `keep_vars: true` into the wrangler.json Nitro generates for the
 * Cloudflare Pages build.
 *
 * Why this exists: Cloudflare documents that deploying with a Wrangler
 * configuration present overrides dashboard-set environment variables and
 * secrets, unless that config sets `keep_vars`. Nitro's cloudflare-pages
 * preset writes its own wrangler.json into the build output on every build,
 * and the build tooling that generates it does not set `keep_vars` and does
 * not expose a way to add it — which is what has been silently wiping the
 * Turso credentials on every deploy.
 *
 * This runs automatically after `npm run build` (npm's built-in `postbuild`
 * lifecycle hook — no wiring needed beyond the script existing in
 * package.json) and edits the file Nitro already wrote, adding exactly one
 * key. Everything else in that file — compatibility_date,
 * compatibility_flags, the worker name — is untouched, so nothing about how
 * the Worker itself runs changes.
 *
 * Deliberately silent and non-fatal if the file isn't where expected: local
 * builds under other presets (the ones this repo's own default falls back to
 * outside a real Cloudflare Pages build) never produce this file at all, and
 * a missing file here must never fail someone's build over it.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const CANDIDATES = ["dist/_worker.js/wrangler.json", ".output/server/wrangler.json"];

function patch(path) {
  const raw = readFileSync(path, "utf8");
  const config = JSON.parse(raw);

  if (config.keep_vars === true) {
    console.log(`[patch-wrangler-keep-vars] ${path} already has keep_vars: true — nothing to do.`);
    return true;
  }

  config.keep_vars = true;
  writeFileSync(path, JSON.stringify(config, null, 2) + "\n");
  console.log(`[patch-wrangler-keep-vars] Set keep_vars: true in ${path}`);
  return true;
}

let patched = false;
for (const candidate of CANDIDATES) {
  const path = join(process.cwd(), candidate);
  if (!existsSync(path)) continue;
  try {
    patched = patch(path) || patched;
  } catch (err) {
    // A malformed or unreadable file here should not take down the whole
    // build — worst case, the pre-existing (unpatched) behaviour applies.
    console.warn(`[patch-wrangler-keep-vars] Could not patch ${path}:`, err.message);
  }
}

if (!patched) {
  console.log(
    "[patch-wrangler-keep-vars] No generated wrangler.json found (expected outside a Cloudflare Pages build) — skipping.",
  );
}
