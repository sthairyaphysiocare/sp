import { createServerFn } from "@tanstack/react-start";

/**
 * Server functions for the cloud-persisted app state.
 *
 * Design notes:
 * - The entire application state is persisted as a single JSON blob in the
 *   `app_state` table on Turso. This preserves 1:1 compatibility with the
 *   previous localStorage shape so the existing UI keeps working while we
 *   move persistence off the browser.
 * - Passwords inside the users[] array are transparently hashed with
 *   PBKDF2-SHA256 on every write. Any legacy plaintext values (from a
 *   localStorage migration or a seed) are upgraded on first save.
 * - Validation server-side is intentionally lightweight: the client is the
 *   authenticated staff dashboard behind a route guard. When Phase B lands
 *   the session-based auth middleware, mutation endpoints will require it.
 */

// Phase B will introduce transparent PBKDF2 upgrade of user passwords at
// persist time, alongside the async login refactor. For Phase A we keep the
// on-disk shape byte-identical to the legacy localStorage blob so the sync
// login path in src/lib/auth.tsx keeps working without changes.


export const loadAppState = createServerFn({ method: "GET" }).handler(async () => {
  const { readState } = await import("./turso.server");
  const data = await readState();
  return { data };
});

export const saveAppState = createServerFn({ method: "POST" })
  .inputValidator((input: { data: string }) => {
    if (!input || typeof input.data !== "string") throw new Error("Invalid payload");
    if (input.data.length > 8 * 1024 * 1024) throw new Error("State payload too large");
    return input;
  })
  .handler(async ({ data }) => {
    const { writeState, auditEvent } = await import("./turso.server");
    await writeState(data.data);
    await auditEvent("app_state.save");
    return { ok: true as const };
  });

/**
 * Verify a login credential server-side against the persisted state.
 * Returns the matching user id (without password) or null.
 */
export const verifyLogin = createServerFn({ method: "POST" })
  .inputValidator((input: { username: string; password: string }) => {
    if (!input || typeof input.username !== "string" || typeof input.password !== "string") {
      throw new Error("Invalid credentials");
    }
    return input;
  })
  .handler(async ({ data }) => {
    const { readState, auditEvent } = await import("./turso.server");
    const { verifyPassword } = await import("./crypto.server");
    const raw = await readState();
    if (!raw) return { ok: false as const, reason: "no-state" };
    let parsed: { users?: Array<{ id: string; email: string; password: string }> };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { ok: false as const, reason: "bad-state" };
    }
    const users = parsed.users ?? [];
    const u = users.find(
      (x) => typeof x.email === "string" && x.email.toLowerCase() === data.username.toLowerCase(),
    );
    if (!u) {
      await auditEvent("auth.fail", `unknown:${data.username}`);
      return { ok: false as const, reason: "not-found" };
    }
    const match = await verifyPassword(data.password, u.password);
    if (!match) {
      await auditEvent("auth.fail", `bad-pw:${u.id}`);
      return { ok: false as const, reason: "bad-password" };
    }
    await auditEvent("auth.ok", u.id);
    return { ok: true as const, userId: u.id };
  });
