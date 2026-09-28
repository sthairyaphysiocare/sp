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

/**
 * How many patients the initial snapshot loads into the browser.
 *
 * Every page load previously read EVERY patient, visit and note with no LIMIT.
 * At 50,000 patients that is roughly 250,000 rows per page load — slow to
 * transfer, heavy in browser memory, and eventually over Turso's read quota.
 *
 * The snapshot now carries a bounded window of the most recently created
 * patients (plus only those patients' visits and notes). Anything outside the
 * window is fetched on demand by id, so nothing becomes unreachable.
 *
 * Bounding the READ is only safe because of how writes now work: the sync
 * sends only records whose fingerprint changed, and deletes only ids the user
 * explicitly deleted. A patient absent from the window is therefore absent
 * from every payload and cannot be written or removed. Under the older
 * "delete anything missing from the payload" behaviour this same change would
 * have wiped every patient outside the window on the first save.
 *
 * 2,000 is chosen to be far above this clinic's working set (roughly a year of
 * intake at their stated growth) so the window is invisible in normal use,
 * while still bounding a worst case.
 */
const SNAPSHOT_PATIENT_WINDOW = 2000;

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
  /**
   * True row counts in the database, independent of the loaded window, so the
   * UI can show accurate totals rather than the size of what it happens to
   * hold. Also lets the client tell "window is full" from "that is everything".
   */
  counts: { patients: number; visits: number; notes: number };
}

export async function readSnapshot(): Promise<DbSnapshot> {
  await ensureSchema();
  await migrateAppStateIfNeeded();
  const db = turso();

  // The window is defined as the most RECENTLY created patients, then restored
  // to ascending order below so the UI sees exactly the ordering it always
  // has. Visits and notes are restricted to that same set of patients, so a
  // large historical archive cannot drag the page load down.
  const windowSql = `SELECT id FROM patients ORDER BY created_at DESC LIMIT ${SNAPSHOT_PATIENT_WINDOW}`;

  // All reads in one batch = one HTTP subrequest (Workers cap subrequests).
  const [uRes, pRes, vRes, nRes, bRes, blRes, stRes, cRes] = await db.batch(
    [
      "SELECT * FROM users",
      `SELECT * FROM patients ORDER BY created_at DESC LIMIT ${SNAPSHOT_PATIENT_WINDOW}`,
      `SELECT * FROM visits WHERE patient_id IN (${windowSql}) ORDER BY visit_number ASC`,
      `SELECT * FROM clinical_notes WHERE patient_id IN (${windowSql})`,
      "SELECT * FROM bookings ORDER BY created_at ASC",
      "SELECT * FROM blocked_slots",
      { sql: "SELECT data FROM app_settings WHERE id = ?", args: ["main"] },
      `SELECT
         (SELECT COUNT(*) FROM patients)       AS p,
         (SELECT COUNT(*) FROM visits)         AS v,
         (SELECT COUNT(*) FROM clinical_notes) AS n`,
    ],
    "read",
  );
  type R = Array<Record<string, unknown>>;
  const users = (uRes.rows as unknown as R).map(rowToUser);
  // Restore ascending creation order: the window is selected newest-first to
  // get the RIGHT rows, but the app has always presented patients oldest-first
  // and nothing downstream should have to change.
  const patients = (pRes.rows as unknown as R).map(rowToPatient).reverse();
  const visits = (vRes.rows as unknown as R).map(rowToVisit);
  const notes = (nRes.rows as unknown as R).map(rowToNote);
  const bookings = (bRes.rows as unknown as R).map(rowToBooking);
  const blocked = (blRes.rows as unknown as R).map(rowToBlocked);

  const countRow = (cRes.rows[0] ?? {}) as Record<string, unknown>;
  const counts = {
    patients: Number(countRow.p ?? patients.length),
    visits: Number(countRow.v ?? visits.length),
    notes: Number(countRow.n ?? notes.length),
  };

  let settings: AppSettings | null = null;
  if (stRes.rows[0]) {
    try {
      settings = JSON.parse(String(stRes.rows[0].data)) as AppSettings;
    } catch (err) {
      console.error("[turso] app_settings row is corrupt JSON:", err);
    }
  }

  // `empty` must reflect the DATABASE, not the window, so a populated database
  // can never be mistaken for a fresh install. Uses the true counts.
  const empty =
    users.length === 0 &&
    counts.patients === 0 &&
    counts.visits === 0 &&
    counts.notes === 0 &&
    bookings.length === 0 &&
    blocked.length === 0 &&
    settings === null;

  return { users, patients, visits, notes, bookings, blocked, settings, empty, counts };
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

/**
 * Fetch ONE patient with their visits and notes, by id.
 *
 * The initial snapshot carries only a bounded window of patients, so a record
 * outside that window would otherwise be unreachable. This keeps every patient
 * openable regardless of how large the archive grows, and is read-only: it
 * cannot create, modify or remove anything.
 */
export async function readPatientBundle(patientId: string): Promise<{
  patient: Patient | null;
  visits: Visit[];
  notes: ClinicalNote[];
}> {
  await ensureSchema();
  const db = turso();
  const [pRes, vRes, nRes] = await db.batch(
    [
      { sql: "SELECT * FROM patients WHERE id = ? LIMIT 1", args: [patientId] },
      {
        sql: "SELECT * FROM visits WHERE patient_id = ? ORDER BY visit_number ASC",
        args: [patientId],
      },
      { sql: "SELECT * FROM clinical_notes WHERE patient_id = ?", args: [patientId] },
    ],
    "read",
  );
  type R = Array<Record<string, unknown>>;
  const prow = (pRes.rows as unknown as R)[0];
  return {
    patient: prow ? rowToPatient(prow) : null,
    visits: (vRes.rows as unknown as R).map(rowToVisit),
    notes: (nRes.rows as unknown as R).map(rowToNote),
  };
}

/**
 * Search patients across the WHOLE table, not just the loaded window.
 *
 * The patients list filters its in-memory array, which silently stops finding
 * older records once the archive exceeds the window. This runs the same kind
 * of match in SQL so search keeps working at any size. Read-only, parameter-
 * bound, and capped so a broad query cannot pull the table into memory.
 */
export async function searchPatientsServer(query: string, limit = 50): Promise<Patient[]> {
  await ensureSchema();
  const q = query.trim();
  if (!q) return [];
  const db = turso();
  const like = `%${q.toLowerCase()}%`;
  const res = await db.execute({
    sql: `SELECT * FROM patients
          WHERE lower(full_name) LIKE ?
             OR lower(search_name) LIKE ?
             OR lower(patient_id) LIKE ?
             OR mobile LIKE ?
          ORDER BY created_at DESC
          LIMIT ?`,
    args: [like, like, like, like, Math.min(Math.max(limit, 1), 200)],
  });
  type R = Array<Record<string, unknown>>;
  return (res.rows as unknown as R).map(rowToPatient);
}
