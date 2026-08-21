/**
 * Formats a caught error for safe inclusion in the fallback page.
 *
 * Kept deliberately minimal — name, message, and the first few stack frames
 * only. JS error text essentially never contains secret *values* (a missing
 * credential throws with the variable's *name*, e.g. "TURSO_AUTH_TOKEN is not
 * configured", never the token itself) but nothing here should be trusted
 * blindly, so this stays conservative and truncates hard.
 *
 * Wrapped in its own try/catch: formatting the error for display must never
 * become a second error. On any failure this returns undefined and the page
 * renders exactly as it did before — silent degradation, not a crash.
 */
function formatErrorDetail(error: unknown): string | undefined {
  try {
    const err = error instanceof Error ? error : new Error(String(error));
    const stackLines = (err.stack ?? "").split("\n").slice(0, 6).join("\n");
    const text = `${err.name}: ${err.message}\n${stackLines}`.slice(0, 2000);
    // HTML-comment-safe: a literal "-->" in the message could otherwise close
    // the comment early and leak the rest of the page's markup as visible text.
    return text.replace(/--/g, "\u2011\u2011");
  } catch {
    return undefined;
  }
}

/**
 * Renders the generic "something went wrong" page shown for any server-side
 * failure. `detail`, when provided, is embedded as an HTML comment — invisible
 * to a visitor looking at the rendered page, but present in view-source /
 * "Copy page source", which is a far faster path to the real cause than
 * digging through Cloudflare's live log stream for the matching request.
 */
export function renderErrorPage(error?: unknown): string {
  const detail = error !== undefined ? formatErrorDetail(error) : undefined;
  const diagnostic = detail
    ? `\n  <!-- DIAGNOSTIC (view-source only, safe to share with support):\n${detail}\n  -->`
    : "";
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>This page didn't load</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font: 15px/1.5 system-ui, -apple-system, sans-serif; background: #fafafa; color: #111; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 28rem; width: 100%; text-align: center; padding: 2rem; }
      h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
      p { color: #4b5563; margin: 0 0 1.5rem; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a, button { padding: 0.5rem 1rem; border-radius: 0.375rem; font: inherit; cursor: pointer; text-decoration: none; border: 1px solid transparent; }
      .primary { background: #111; color: #fff; }
      .secondary { background: #fff; color: #111; border-color: #d1d5db; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>This page didn't load</h1>
      <p>Something went wrong on our end. You can try refreshing or head back home.</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">Try again</button>
        <a class="secondary" href="/">Go home</a>
      </div>
    </div>
  </body>${diagnostic}
</html>`;
}
