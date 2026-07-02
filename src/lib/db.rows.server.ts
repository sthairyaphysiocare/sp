/**
 * Explicit row <-> interface mapping + record-by-record migration.
 *
 * Every INSERT/UPDATE in this file is a parameterized query
 * (client.execute({ sql, args })) — special characters in patient data can
 * never break the SQL. Column lists are written out by hand; nothing loops
 * over object keys to guess columns.
 */
import type { Client, InArgs } from "@libsql/client/web";
import type {
  AppSettings,
  BlockedSlot,
  Booking,
  ClinicalNote,
  Patient,
  User,
  Visit,
} from "./types";
import { turso } from "./turso.server";
import { coreTablesEmpty } from "./schema.server";
import { hashPassword, isHashed } from "./crypto.server";

// ---------------------------------------------------------------------------
// Upsert SQL — static strings, explicit column lists, positional parameters.
// ---------------------------------------------------------------------------
export const UPSERT_USER = `
  INSERT INTO users (id, email, name, role, password_hash, contact_email, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    email = excluded.email, name = excluded.name, role = excluded.role,
    password_hash = excluded.password_hash, contact_email = excluded.contact_email`;

export const UPSERT_PATIENT = `
  INSERT INTO patients (
    id, patient_id, full_name, search_name, dob, gender, mobile, alt_mobile,
    email, occupation, emergency, emergency_name, emergency_phone, blood_group,
    height_cm, weight_kg, chief_complaint, present_illness, surgical_history,
    medications, allergies, comorbidities, lifestyle, family_history,
    branch_id, therapist_id, status, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    patient_id = excluded.patient_id, full_name = excluded.full_name,
    search_name = excluded.search_name, dob = excluded.dob, gender = excluded.gender,
    mobile = excluded.mobile, alt_mobile = excluded.alt_mobile, email = excluded.email,
    occupation = excluded.occupation, emergency = excluded.emergency,
    emergency_name = excluded.emergency_name, emergency_phone = excluded.emergency_phone,
    blood_group = excluded.blood_group, height_cm = excluded.height_cm,
    weight_kg = excluded.weight_kg, chief_complaint = excluded.chief_complaint,
    present_illness = excluded.present_illness, surgical_history = excluded.surgical_history,
    medications = excluded.medications, allergies = excluded.allergies,
    comorbidities = excluded.comorbidities, lifestyle = excluded.lifestyle,
    family_history = excluded.family_history, branch_id = excluded.branch_id,
    therapist_id = excluded.therapist_id, status = excluded.status,
    created_at = excluded.created_at`;

export const UPSERT_VISIT = `
  INSERT INTO visits (
    id, patient_id, visit_number, visit_date, therapist_id, therapist_name,
    pain_score, symptoms, rom, strength, treatment, advice,
    functional_improvement, next_date, next_time, duration_min
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    patient_id = excluded.patient_id, visit_number = excluded.visit_number,
    visit_date = excluded.visit_date, therapist_id = excluded.therapist_id,
    therapist_name = excluded.therapist_name, pain_score = excluded.pain_score,
    symptoms = excluded.symptoms, rom = excluded.rom, strength = excluded.strength,
    treatment = excluded.treatment, advice = excluded.advice,
    functional_improvement = excluded.functional_improvement,
    next_date = excluded.next_date, next_time = excluded.next_time,
    duration_min = excluded.duration_min`;

export const UPSERT_NOTE = `
  INSERT INTO clinical_notes (id, patient_id, note_date, note_time, therapist_name, message)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    patient_id = excluded.patient_id, note_date = excluded.note_date,
    note_time = excluded.note_time, therapist_name = excluded.therapist_name,
    message = excluded.message`;

export const UPSERT_BOOKING = `
  INSERT INTO bookings (id, name, phone, email, concern, preferred, pref_date, pref_time, branch_id, status, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    name = excluded.name, phone = excluded.phone, email = excluded.email,
    concern = excluded.concern, preferred = excluded.preferred,
    pref_date = excluded.pref_date, pref_time = excluded.pref_time,
    branch_id = excluded.branch_id, status = excluded.status,
    created_at = excluded.created_at`;

export const UPSERT_BLOCKED = `
  INSERT INTO blocked_slots (id, slot_date, slot_time, duration_min, reason, blocked_by)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    slot_date = excluded.slot_date, slot_time = excluded.slot_time,
    duration_min = excluded.duration_min, reason = excluded.reason,
    blocked_by = excluded.blocked_by`;

export const UPSERT_SETTINGS = `
  INSERT INTO app_settings (id, data, updated_at) VALUES (?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`;

// ---------------------------------------------------------------------------
// Interface -> positional args (explicit field-by-field, no key iteration).
// ---------------------------------------------------------------------------
export async function userArgs(u: User): Promise<InArgs> {
  const pw = typeof u.password === "string" ? u.password : "";
  const hashed = pw.length === 0 || isHashed(pw) ? pw : await hashPassword(pw);
  return [
    u.id,
    u.email ?? "",
    u.name ?? "",
    u.role ?? "other",
    hashed,
    u.emailId ?? "",
    Date.now(),
  ];
}

export function patientArgs(p: Patient): InArgs {
  return [
    p.id,
    p.pid ?? "",
    p.n ?? "",
    p.sn ?? (p.n ?? "").toLowerCase(),
    p.dob ?? "",
    p.g ?? "O",
    p.m ?? "",
    p.am ?? "",
    p.e ?? "",
    p.oc ?? "",
    p.em ?? "",
    p.emN ?? "",
    p.emP ?? "",
    p.bg ?? "",
    Number(p.h) || 0,
    Number(p.w) || 0,
    p.cc ?? "",
    p.pi ?? "",
    p.sx ?? "",
    p.med ?? "",
    p.al ?? "",
    JSON.stringify(Array.isArray(p.cm) ? p.cm : []),
    p.lf ?? "",
    p.fh ?? "",
    p.br ?? null,
    p.tId ?? null,
    p.status ?? "active",
    Number(p.ts) || Date.now(),
  ];
}

export function visitArgs(v: Visit): InArgs {
  return [
    v.id,
    v.patientId,
    Number(v.vN) || 1,
    v.dt ?? "",
    v.tId ?? "",
    v.tN ?? "",
    Number(v.pS) || 0,
    v.sym ?? "",
    v.rom ?? "",
    v.str ?? "",
    v.tx ?? "",
    v.adv ?? "",
    Number(v.fi) || 0,
    v.nxt ?? "",
    v.nxtTm ?? null,
    v.dur == null ? null : Number(v.dur),
  ];
}

export function noteArgs(n: ClinicalNote): InArgs {
  return [n.id, n.patientId, n.dt ?? "", n.tm ?? "", n.tN ?? "", n.msg ?? ""];
}

export function bookingArgs(b: Booking): InArgs {
  return [
    b.id,
    b.name ?? "",
    b.phone ?? "",
    b.email ?? "",
    b.concern ?? "",
    b.preferred ?? "",
    b.prefDate ?? null,
    b.prefTime ?? null,
    b.br ?? null,
    b.status ?? "pending",
    Number(b.ts) || Date.now(),
  ];
}

export function blockedArgs(b: BlockedSlot): InArgs {
  return [b.id, b.date ?? "", b.time ?? "", Number(b.dur) || 30, b.reason ?? "", b.by ?? ""];
}

// ---------------------------------------------------------------------------
// SQL row -> interface (explicit column-by-column).
// ---------------------------------------------------------------------------
type Row = Record<string, unknown>;
const s = (v: unknown): string => (v == null ? "" : String(v));
const num = (v: unknown): number => (v == null ? 0 : Number(v));

export function rowToUser(r: Row): User {
  return {
    id: s(r.id),
    email: s(r.email),
    name: s(r.name),
    role: (s(r.role) || "other") as User["role"],
    password: s(r.password_hash),
    emailId: s(r.contact_email),
    locked: Number(r.locked ?? 0) === 1,
  };
}

export function rowToPatient(r: Row): Patient {
  let cm: number[] = [];
  try {
    const parsed = JSON.parse(s(r.comorbidities) || "[]");
    if (Array.isArray(parsed)) cm = parsed.map(Number).filter((x) => !Number.isNaN(x));
  } catch {
    /* keep [] */
  }
  return {
    id: s(r.id),
    pid: s(r.patient_id),
    n: s(r.full_name),
    sn: s(r.search_name),
    dob: s(r.dob),
    g: (s(r.gender) || "O") as Patient["g"],
    m: s(r.mobile),
    am: s(r.alt_mobile),
    e: s(r.email),
    oc: s(r.occupation),
    em: s(r.emergency),
    emN: s(r.emergency_name),
    emP: s(r.emergency_phone),
    bg: s(r.blood_group),
    h: num(r.height_cm),
    w: num(r.weight_kg),
    cc: s(r.chief_complaint),
    pi: s(r.present_illness),
    sx: s(r.surgical_history),
    med: s(r.medications),
    al: s(r.allergies),
    cm,
    lf: s(r.lifestyle),
    fh: s(r.family_history),
    br: r.branch_id == null ? undefined : s(r.branch_id),
    tId: r.therapist_id == null ? undefined : s(r.therapist_id),
    status: (s(r.status) || "active") as Patient["status"],
    ts: num(r.created_at),
  };
}

export function rowToVisit(r: Row): Visit {
  return {
    id: s(r.id),
    patientId: s(r.patient_id),
    vN: num(r.visit_number),
    dt: s(r.visit_date),
    tId: s(r.therapist_id),
    tN: s(r.therapist_name),
    pS: num(r.pain_score),
    sym: s(r.symptoms),
    rom: s(r.rom),
    str: s(r.strength),
    tx: s(r.treatment),
    adv: s(r.advice),
    fi: num(r.functional_improvement),
    nxt: s(r.next_date),
    nxtTm: r.next_time == null ? undefined : s(r.next_time),
    dur: r.duration_min == null ? undefined : num(r.duration_min),
  };
}

export function rowToNote(r: Row): ClinicalNote {
  return {
    id: s(r.id),
    patientId: s(r.patient_id),
    dt: s(r.note_date),
    tm: s(r.note_time),
    tN: s(r.therapist_name),
    msg: s(r.message),
  };
}

export function rowToBooking(r: Row): Booking {
  return {
    id: s(r.id),
    name: s(r.name),
    phone: s(r.phone),
    email: s(r.email),
    concern: s(r.concern),
    preferred: s(r.preferred),
    prefDate: r.pref_date == null ? undefined : s(r.pref_date),
    prefTime: r.pref_time == null ? undefined : s(r.pref_time),
    br: r.branch_id == null ? undefined : s(r.branch_id),
    status: (s(r.status) || "pending") as Booking["status"],
    ts: num(r.created_at),
  };
}

export function rowToBlocked(r: Row): BlockedSlot {
  return {
    id: s(r.id),
    date: s(r.slot_date),
    time: s(r.slot_time),
    dur: num(r.duration_min),
    reason: s(r.reason),
    by: s(r.blocked_by),
  };
}

// ---------------------------------------------------------------------------
// Record-by-record migration
// ---------------------------------------------------------------------------
export interface LegacyBlobShape {
  users?: User[];
  patients?: Patient[];
  visits?: Visit[];
  notes?: ClinicalNote[];
  bookings?: Booking[];
  blocked?: BlockedSlot[];
  settings?: AppSettings;
}

export interface MigrationReport {
  ran: boolean;
  source: "localStorage" | "app_state" | "none";
  inserted: Record<string, number>;
  failed: Record<string, number>;
}

async function insertLoop<T extends { id?: unknown }>(
  db: Client,
  label: string,
  records: T[] | undefined,
  sql: string,
  toArgs: (rec: T) => InArgs | Promise<InArgs>,
  report: MigrationReport,
): Promise<void> {
  const list = Array.isArray(records) ? records : [];
  report.inserted[label] = 0;
  report.failed[label] = 0;
  for (const rec of list) {
    try {
      const args = await toArgs(rec);
      // Parameterized insert — special characters in data cannot break SQL.
      await db.execute({ sql, args });
      report.inserted[label]++;
    } catch (err) {
      // Log the exact error AND the specific record, then CONTINUE the loop.
      console.error(`[migration] failed to insert ${label} record:`, err, "record:", rec);
      report.failed[label]++;
    }
  }
}

/**
 * Migrate a legacy JSON blob (from browser localStorage, or from the old
 * app_state table) into the normalized tables — one record at a time, with
 * parameterized queries, continuing past individual failures.
 *
 * Runs ONLY if the core tables are empty; otherwise it is a no-op so it can
 * never overwrite live data.
 */
export async function migrateLegacyBlob(
  raw: string,
  source: MigrationReport["source"],
): Promise<MigrationReport> {
  const report: MigrationReport = { ran: false, source, inserted: {}, failed: {} };

  if (!(await coreTablesEmpty())) return report; // tables already populated — never migrate over data

  let blob: LegacyBlobShape;
  try {
    blob = JSON.parse(raw) as LegacyBlobShape;
  } catch (err) {
    console.error("[migration] legacy blob is not valid JSON — aborting migration", err);
    return report;
  }

  const db = turso();
  report.ran = true;

  await insertLoop(db, "users", blob.users, UPSERT_USER, userArgs, report);
  await insertLoop(db, "patients", blob.patients, UPSERT_PATIENT, patientArgs, report);
  await insertLoop(db, "visits", blob.visits, UPSERT_VISIT, visitArgs, report);
  await insertLoop(db, "clinical_notes", blob.notes, UPSERT_NOTE, noteArgs, report);
  await insertLoop(db, "bookings", blob.bookings, UPSERT_BOOKING, bookingArgs, report);
  await insertLoop(db, "blocked_slots", blob.blocked, UPSERT_BLOCKED, blockedArgs, report);

  if (blob.settings) {
    try {
      await db.execute({
        sql: UPSERT_SETTINGS,
        args: ["main", JSON.stringify(blob.settings), Date.now()],
      });
      report.inserted["app_settings"] = 1;
    } catch (err) {
      console.error("[migration] failed to insert settings:", err, "record:", blob.settings);
      report.failed["app_settings"] = 1;
    }
  }

  console.info("[migration] complete", report);
  return report;
}
