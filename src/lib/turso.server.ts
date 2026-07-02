import { createClient, type Client } from "@libsql/client/web";

let cached: Client | null = null;

export function turso(): Client {
  if (cached) return cached;
  const url = process.env.TURSO_DB_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) {
    throw new Error("Turso credentials are not configured (TURSO_DB_URL / TURSO_AUTH_TOKEN).");
  }
  cached = createClient({ url, authToken });
  return cached;
}

let initPromise: Promise<void> | null = null;

/**
 * Initialize schema. Uses a single-row app_state blob table so the entire
 * DB shape (mirroring the previous localStorage layout) migrates 1:1 with
 * zero risk of column drift while UI is progressively decomposed into
 * granular tables in later phases.
 *
 * Passwords are NEVER stored as plain text. They are hashed via
 * PBKDF2-SHA256 (Worker-compatible) before persistence. See ./crypto.server.
 */
export async function ensureSchema(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const db = turso();
    await db.batch(
      [
        "PRAGMA foreign_keys = ON;",
        `CREATE TABLE IF NOT EXISTS app_state (
          id TEXT PRIMARY KEY,
          data TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        );`,
        `CREATE TABLE IF NOT EXISTS audit_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          event TEXT NOT NULL,
          detail TEXT,
          at INTEGER NOT NULL
        );`,
      ],
      "write",
    );
  })().catch((e) => {
    initPromise = null;
    throw e;
  });
  return initPromise;
}

export async function readState(): Promise<string | null> {
  await ensureSchema();
  const db = turso();
  const res = await db.execute({
    sql: "SELECT data FROM app_state WHERE id = ?",
    args: ["main"],
  });
  const row = res.rows[0];
  if (!row) return null;
  return String(row.data);
}

export async function writeState(data: string): Promise<void> {
  await ensureSchema();
  const db = turso();
  await db.execute({
    sql: `INSERT INTO app_state (id, data, updated_at) VALUES (?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
    args: ["main", data, Date.now()],
  });
}

export async function auditEvent(event: string, detail?: string): Promise<void> {
  try {
    await ensureSchema();
    const db = turso();
    await db.execute({
      sql: "INSERT INTO audit_log (event, detail, at) VALUES (?, ?, ?)",
      args: [event, detail ?? null, Date.now()],
    });
  } catch {
    // audit is best-effort; never break the request path
  }
}
