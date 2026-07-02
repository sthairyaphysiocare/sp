/**
 * STATIC SCHEMA INITIALIZATION — no dynamic/runtime SQL generation.
 *
 * Every statement below is a hardcoded string executed sequentially via
 * client.execute(). Column names are explicitly typed to match the
 * TypeScript interfaces in ./types.ts (short interface keys are mapped to
 * readable SQL column names in db.rows.server.ts).
 *
 * If any statement fails, the exact SQL string is logged via console.error
 * before the error is re-thrown — nothing is swallowed.
 */
import type { Client } from "@libsql/client/web";
import { turso } from "./turso.server";

// ---------------------------------------------------------------------------
// Hardcoded DDL — one statement per table, executed in this exact order.
// ---------------------------------------------------------------------------
export const SCHEMA_STATEMENTS: ReadonlyArray<string> = [
  // Staff accounts. `password_hash` stores PBKDF2-SHA256 (never plaintext).
  `CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    email         TEXT NOT NULL,
    name          TEXT NOT NULL DEFAULT '',
    role          TEXT NOT NULL DEFAULT 'other',
    password_hash TEXT NOT NULL DEFAULT '',
    contact_email TEXT NOT NULL DEFAULT '',
    created_at    INTEGER NOT NULL DEFAULT 0
  )`,

  // Patient master record (maps 1:1 to the Patient interface).
  `CREATE TABLE IF NOT EXISTS patients (
    id               TEXT PRIMARY KEY,
    patient_id       TEXT NOT NULL,
    full_name        TEXT NOT NULL,
    search_name      TEXT NOT NULL DEFAULT '',
    dob              TEXT NOT NULL DEFAULT '',
    gender           TEXT NOT NULL DEFAULT 'O',
    mobile           TEXT NOT NULL DEFAULT '',
    alt_mobile       TEXT NOT NULL DEFAULT '',
    email            TEXT NOT NULL DEFAULT '',
    occupation       TEXT NOT NULL DEFAULT '',
    emergency        TEXT NOT NULL DEFAULT '',
    emergency_name   TEXT NOT NULL DEFAULT '',
    emergency_phone  TEXT NOT NULL DEFAULT '',
    blood_group      TEXT NOT NULL DEFAULT '',
    height_cm        REAL NOT NULL DEFAULT 0,
    weight_kg        REAL NOT NULL DEFAULT 0,
    chief_complaint  TEXT NOT NULL DEFAULT '',
    present_illness  TEXT NOT NULL DEFAULT '',
    surgical_history TEXT NOT NULL DEFAULT '',
    medications      TEXT NOT NULL DEFAULT '',
    allergies        TEXT NOT NULL DEFAULT '',
    comorbidities    TEXT NOT NULL DEFAULT '[]',
    lifestyle        TEXT NOT NULL DEFAULT '',
    family_history   TEXT NOT NULL DEFAULT '',
    branch_id        TEXT,
    therapist_id     TEXT,
    status           TEXT NOT NULL DEFAULT 'active',
    created_at       INTEGER NOT NULL DEFAULT 0
  )`,

  // Treatment visits / sessions (maps to the Visit interface). Prescriptions
  // in this app are generated as PDFs from the latest visit, so visit rows
  // are the persisted clinical record.
  `CREATE TABLE IF NOT EXISTS visits (
    id                     TEXT PRIMARY KEY,
    patient_id             TEXT NOT NULL,
    visit_number           INTEGER NOT NULL DEFAULT 1,
    visit_date             TEXT NOT NULL DEFAULT '',
    therapist_id           TEXT NOT NULL DEFAULT '',
    therapist_name         TEXT NOT NULL DEFAULT '',
    pain_score             REAL NOT NULL DEFAULT 0,
    symptoms               TEXT NOT NULL DEFAULT '',
    rom                    TEXT NOT NULL DEFAULT '',
    strength               TEXT NOT NULL DEFAULT '',
    treatment              TEXT NOT NULL DEFAULT '',
    advice                 TEXT NOT NULL DEFAULT '',
    functional_improvement REAL NOT NULL DEFAULT 0,
    next_date              TEXT NOT NULL DEFAULT '',
    next_time              TEXT,
    duration_min           INTEGER
  )`,

  // Free-text clinical notes (maps to the ClinicalNote interface).
  `CREATE TABLE IF NOT EXISTS clinical_notes (
    id             TEXT PRIMARY KEY,
    patient_id     TEXT NOT NULL,
    note_date      TEXT NOT NULL DEFAULT '',
    note_time      TEXT NOT NULL DEFAULT '',
    therapist_name TEXT NOT NULL DEFAULT '',
    message        TEXT NOT NULL DEFAULT ''
  )`,

  // Public appointment requests (maps to the Booking interface).
  `CREATE TABLE IF NOT EXISTS bookings (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL DEFAULT '',
    phone      TEXT NOT NULL DEFAULT '',
    email      TEXT NOT NULL DEFAULT '',
    concern    TEXT NOT NULL DEFAULT '',
    preferred  TEXT NOT NULL DEFAULT '',
    pref_date  TEXT,
    pref_time  TEXT,
    branch_id  TEXT,
    status     TEXT NOT NULL DEFAULT 'pending',
    created_at INTEGER NOT NULL DEFAULT 0
  )`,

  // Calendar slots blocked by staff (maps to the BlockedSlot interface).
  `CREATE TABLE IF NOT EXISTS blocked_slots (
    id           TEXT PRIMARY KEY,
    slot_date    TEXT NOT NULL DEFAULT '',
    slot_time    TEXT NOT NULL DEFAULT '',
    duration_min INTEGER NOT NULL DEFAULT 30,
    reason       TEXT NOT NULL DEFAULT '',
    blocked_by   TEXT NOT NULL DEFAULT ''
  )`,

  // Clinic configuration (branches, specialities, clinicians, public stats).
  // This is nested configuration — not tabular records — so it lives in a
  // single explicitly-defined row keyed by 'main'.
  `CREATE TABLE IF NOT EXISTS app_settings (
    id         TEXT PRIMARY KEY,
    data       TEXT NOT NULL,
    updated_at INTEGER NOT NULL DEFAULT 0
  )`,

  // Append-only audit trail.
  `CREATE TABLE IF NOT EXISTS audit_log (
    id     INTEGER PRIMARY KEY AUTOINCREMENT,
    event  TEXT NOT NULL,
    detail TEXT,
    at     INTEGER NOT NULL
  )`,

  // Legacy single-blob table. Kept ONLY as a read source for the one-time
  // migration into the tables above. Never written to after cutover.
  `CREATE TABLE IF NOT EXISTS app_state (
    id         TEXT PRIMARY KEY,
    data       TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )`,

  // Helpful lookup indexes.
  `CREATE INDEX IF NOT EXISTS idx_visits_patient ON visits (patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_notes_patient ON clinical_notes (patient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings (status)`,
];

let initPromise: Promise<void> | null = null;

/**
 * Execute the static schema, one statement at a time, in order.
 * Idempotent (CREATE TABLE IF NOT EXISTS) and memoized per server instance.
 */
export async function ensureSchema(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const db: Client = turso();
    for (const sql of SCHEMA_STATEMENTS) {
      try {
        await db.execute(sql);
      } catch (err) {
        console.error("[schema] statement failed. Exact SQL:\n" + sql, err);
        throw err;
      }
    }
  })().catch((e) => {
    initPromise = null; // allow retry on next request
    throw e;
  });
  return initPromise;
}

/** True when the core tables contain no rows (fresh database → safe to migrate). */
export async function coreTablesEmpty(): Promise<boolean> {
  const db = turso();
  const tables = ["users", "patients", "visits", "clinical_notes", "bookings", "blocked_slots"];
  for (const t of tables) {
    // Table names are from the hardcoded list above — never user input.
    const res = await db.execute(`SELECT COUNT(*) AS c FROM ${t}`);
    if (Number(res.rows[0]?.c ?? 0) > 0) return false;
  }
  return true;
}
