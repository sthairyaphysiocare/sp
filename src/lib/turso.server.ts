import { createClient, type Client } from "@libsql/client/web";
import type {
  AppSettings,
  BlockedSlot,
  Booking,
  ClinicalNote,
  Patient,
  User,
  Visit,
} from "./types";
import { ensureSchema } from "./schema.server";
import {
  migrateLegacyBlob,
  type MigrationReport,
  rowToBlocked,
  rowToBooking,
  rowToNote,
  rowToPatient,
  rowToUser,
  rowToVisit,
} from "./db.rows.server";

/**
 * Turso connection — SERVER-SIDE ONLY.
 *
 * The auth token intentionally stays in server env (TURSO_AUTH_TOKEN), never
 * in a VITE_-prefixed variable: anything prefixed VITE_ is compiled into the
 * public browser bundle, which would hand full read/write access to the
 * patient database to every site visitor. All browser access goes through
 * the server functions in db.functions.ts instead.
 *
 * VITE_-prefixed names are still accepted as a fallback *read server-side*
 * so a misnamed env var doesn't take the site down — but a warning is logged.
 */
function resolveEnv(): { url: string; authToken: string } {
  const env = process.env;
  let url = env.TURSO_DB_URL || env.TURSO_DATABASE_URL || "";
  let authToken = env.TURSO_AUTH_TOKEN || "";
  if (!url && env.VITE_TURSO_DB_URL) {
    url = env.VITE_TURSO_DB_URL;
    console.warn(
      "[turso] using VITE_TURSO_DB_URL — rename it to TURSO_DB_URL (VITE_ vars leak into the client bundle).",
    );
  }
  if (!authToken && env.VITE_TURSO_AUTH_TOKEN) {
    authToken = env.VITE_TURSO_AUTH_TOKEN;
    console.warn(
      "[turso] using VITE_TURSO_AUTH_TOKEN — rename it to TURSO_AUTH_TOKEN (VITE_ vars leak into the client bundle).",
    );
  }
  if (!url || !authToken) {
    throw new Error("Turso credentials are not configured (TURSO_DB_URL / TURSO_AUTH_TOKEN).");
  }
  // The @libsql/client/web driver runs on fetch. If the libsql:// (websocket)
  // protocol fails in this environment, force plain HTTPS which works
  // everywhere (Cloudflare Workers, Vercel Edge, Node).
  if (url.startsWith("libsql://")) {
    url = "https://" + url.slice("libsql://".length);
  }
  return { url, authToken };
}

let cached: Client | null = null;

export function turso(): Client {
  if (cached) return cached;
  const { url, authToken } = resolveEnv();
  cached = createClient({ url, authToken });
  return cached;
}

export { ensureSchema };

// ---------------------------------------------------------------------------
// One-time migration from the legacy app_state blob (previous Turso layout).
// ---------------------------------------------------------------------------
let migrationChecked = false;

/**
 * If the normalized tables are empty but the legacy app_state blob exists,
 * migrate it record-by-record. Wrapped in a global try/catch that logs the
 * exact failure without swallowing schema errors.
 */
export async function migrateAppStateIfNeeded(): Promise<MigrationReport | null> {
  if (migrationChecked) return null;
  migrationChecked = true;
  try {
    await ensureSchema();
    const db = turso();
    const sql = "SELECT data FROM app_state WHERE id = ?";
    const res = await db.execute({ sql, args: ["main"] });
    const row = res.rows[0];
    if (!row) return null;
    return await migrateLegacyBlob(String(row.data), "app_state");
  } catch (err) {
    console.error("[turso] app_state migration failed:", err);
    return null;
  }
}

/** Migrate a legacy blob sent from the browser's localStorage. */
export async function migrateLocalStorageBlob(raw: string): Promise<MigrationReport> {
  await ensureSchema();
  return migrateLegacyBlob(raw, "localStorage");
}

// ---------------------------------------------------------------------------
// Reads — reconstruct the typed app state from the normalized tables.
// ---------------------------------------------------------------------------
export interface DbSnapshot {
  users: User[];
  patients: Patient[];
  visits: Visit[];
  notes: ClinicalNote[];
  bookings: Booking[];
  blocked: BlockedSlot[];
  settings: AppSettings | null;
  empty: boolean;
}

export async function readSnapshot(): Promise<DbSnapshot> {
  await ensureSchema();
  await migrateAppStateIfNeeded();
  const db = turso();

  const run = async (sql: string) => (await db.execute(sql)).rows as Array<Record<string, unknown>>;

  const users = (await run("SELECT * FROM users")).map(rowToUser);
  const patients = (await run("SELECT * FROM patients ORDER BY created_at ASC")).map(rowToPatient);
  const visits = (await run("SELECT * FROM visits ORDER BY visit_number ASC")).map(rowToVisit);
  const notes = (await run("SELECT * FROM clinical_notes")).map(rowToNote);
  const bookings = (await run("SELECT * FROM bookings ORDER BY created_at ASC")).map(rowToBooking);
  const blocked = (await run("SELECT * FROM blocked_slots")).map(rowToBlocked);

  let settings: AppSettings | null = null;
  const st = await db.execute({
    sql: "SELECT data FROM app_settings WHERE id = ?",
    args: ["main"],
  });
  if (st.rows[0]) {
    try {
      settings = JSON.parse(String(st.rows[0].data)) as AppSettings;
    } catch (err) {
      console.error("[turso] app_settings row is corrupt JSON:", err);
    }
  }

  const empty =
    users.length === 0 &&
    patients.length === 0 &&
    visits.length === 0 &&
    notes.length === 0 &&
    bookings.length === 0 &&
    blocked.length === 0 &&
    settings === null;

  return { users, patients, visits, notes, bookings, blocked, settings, empty };
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
