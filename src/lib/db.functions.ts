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

async function upgradePasswords(raw: string): Promise<string> {
  const { hashPassword, isHashed } = await import("./crypto.server");
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.users)) return raw;
    let changed = false;
    const users = await Promise.all(
      parsed.users.map(async (u: { password?: string }) => {
        if (typeof u.password === "string" && u.password.length > 0 && !isHashed(u.password)) {
          changed = true;
          return { ...u, password: await hashPassword(u.password) };
        }
        return u;
      }),
    );
    if (!changed) return raw;
    return JSON.stringify({ ...parsed, users });
  } catch {
    return raw;
  }
}

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
    const upgraded = await upgradePasswords(data.data);
    await writeState(upgraded);
    await auditEvent("app_state.save");
    return { ok: true as const, upgraded: upgraded !== data.data };
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
