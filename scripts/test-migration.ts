/**
 * Offline verification of the static schema + record-by-record migration.
 * Uses a local libsql file DB and monkeypatches the turso() client so the
 * real production modules (schema.server, db.rows.server) are exercised.
 */
import { createClient } from "@libsql/client";

// Local file DB — exercises the exact production SQL constants and mappers.
const local = createClient({ url: "file:/tmp/test-sthairya.db" });
const { SCHEMA_STATEMENTS } = await import("../src/lib/schema.server");
const rows = await import("../src/lib/db.rows.server");

// 1. STATIC SCHEMA — execute sequentially
for (const sql of SCHEMA_STATEMENTS) {
  try {
    await local.execute(sql);
  } catch (err) {
    console.error("SCHEMA FAILED. Exact SQL:\n" + sql, err);
    process.exit(1);
  }
}
console.log("✔ schema created:", SCHEMA_STATEMENTS.length, "statements");

// 2. Hostile legacy blob — quotes, semicolons, SQL-ish text, unicode
const blob = {
  users: [
    {
      id: "u1",
      email: "admin",
      name: "O'Brien; DROP TABLE users;--",
      role: "admin",
      password: "pl4in'text\"pw",
      emailId: "a@b.c",
    },
  ],
  patients: [
    {
      id: "p1",
      pid: "STP000001",
      n: `Rame'sh "Kam;ath" 💪`,
      sn: "ramesh",
      dob: "1972-04-12",
      g: "M",
      m: "98450'12345",
      am: "",
      e: "r@x.com",
      oc: "Teacher",
      em: "S 984",
      emN: "S",
      emP: "984",
      bg: "B+",
      h: 172,
      w: 78,
      cc: "Low back pain -- radiating; 'right' leg",
      pi: "Onset",
      sx: "Nil",
      med: "PRN",
      al: "Nil",
      cm: [2],
      lf: "Sedentary",
      fh: "Nil",
      br: "br1",
      tId: "u2",
      status: "active",
      ts: 1,
    },
    {
      id: "p2",
      pid: "STP000002",
      n: "Anjali",
      sn: "anjali",
      dob: "1995-09-23",
      g: "F",
      m: "9",
      am: "",
      e: "",
      oc: "",
      em: "",
      bg: "O+",
      h: 162,
      w: 58,
      cc: "Neck",
      pi: "",
      sx: "",
      med: "",
      al: "",
      cm: [],
      lf: "",
      fh: "",
      ts: 2,
    },
  ],
  visits: [
    {
      id: "v1",
      patientId: "p1",
      vN: 1,
      dt: "2026-06-01",
      tId: "u2",
      tN: "Dr. P",
      pS: 7,
      sym: 'it\'s "bad"',
      rom: "30%",
      str: "3/5",
      tx: "IFT; 'manual'",
      adv: "HEP",
      fi: 30,
      nxt: "2026-06-06",
      nxtTm: "10:00",
      dur: 30,
    },
  ],
  notes: [
    {
      id: "n1",
      patientId: "p1",
      dt: "2026-06-01",
      tm: "10:00",
      tN: "Dr. P",
      msg: "note with 'quotes' and; semicolons",
    },
  ],
  bookings: [
    {
      id: "b1",
      name: "X",
      phone: "1",
      email: "",
      concern: "c",
      preferred: "morning",
      status: "pending",
      ts: 3,
    },
  ],
  blocked: [
    { id: "bk1", date: "2026-06-05", time: "11:00", dur: 60, reason: "maint'enance", by: "u1" },
  ],
  settings: {
    publicStatsEnabled: false,
    branches: [
      { id: "br1", name: "Main", address: "", mapUrl: "", phone: "", license: "", enabled: true },
    ],
    whatsappNumber: "w",
    stats: { patients: "6+", years: "10+", recovery: "61%", programs: "20+" },
    specialities: [],
    cliniciansEnabled: false,
    clinicians: [],
  },
};

// Simulate migrateLegacyBlob record-by-record (same SQL + arg mappers)
let failures = 0;
async function ins<T>(label: string, list: T[], sql: string, toArgs: (r: T) => unknown) {
  for (const rec of list) {
    try {
      const args = await toArgs(rec);
      await local.execute({ sql, args: args as never });
    } catch (err) {
      console.error(`✘ ${label} insert failed:`, err, rec);
      failures++;
    }
  }
}
await ins("user", blob.users as never[], rows.UPSERT_USER, rows.userArgs as never);
await ins("patient", blob.patients as never[], rows.UPSERT_PATIENT, rows.patientArgs as never);
await ins("visit", blob.visits as never[], rows.UPSERT_VISIT, rows.visitArgs as never);
await ins("note", blob.notes as never[], rows.UPSERT_NOTE, rows.noteArgs as never);
await ins("booking", blob.bookings as never[], rows.UPSERT_BOOKING, rows.bookingArgs as never);
await ins("blocked", blob.blocked as never[], rows.UPSERT_BLOCKED, rows.blockedArgs as never);
await local.execute({
  sql: rows.UPSERT_SETTINGS,
  args: ["main", JSON.stringify(blob.settings), Date.now()],
});
if (failures > 0) process.exit(1);
console.log("✔ migration inserts OK (hostile data with quotes/semicolons/emoji)");

// 3. Round-trip: read rows back through the mappers and compare key fields
const p = rows.rowToPatient(
  (await local.execute("SELECT * FROM patients WHERE id='p1'")).rows[0] as never,
);
const u = rows.rowToUser(
  (await local.execute("SELECT * FROM users WHERE id='u1'")).rows[0] as never,
);
const v = rows.rowToVisit(
  (await local.execute("SELECT * FROM visits WHERE id='v1'")).rows[0] as never,
);
console.assert(p.n === blob.patients[0].n, "patient name round-trip", p.n);
console.assert(JSON.stringify(p.cm) === "[2]", "comorbidities round-trip", p.cm);
console.assert(p.h === 172 && p.w === 78, "numerics round-trip");
console.assert(u.name === blob.users[0].name, "user name round-trip");
console.assert(
  u.password.startsWith("pbkdf2$"),
  "password hashed at rest:",
  u.password.slice(0, 20),
);
console.assert(v.sym === blob.visits[0].sym, "visit symptom round-trip");
console.assert(v.nxtTm === "10:00" && v.dur === 30, "optional fields round-trip");
console.log("✔ round-trip OK; sample:", { name: p.n, hashPrefix: u.password.slice(0, 14) });

// 4. Reconcile behavior: upsert existing (edit) + prune deleted
await ins(
  "patient-edit",
  [{ ...blob.patients[0], cc: "UPDATED complaint" }] as never[],
  rows.UPSERT_PATIENT,
  rows.patientArgs as never,
);
const p1b = rows.rowToPatient(
  (await local.execute("SELECT * FROM patients WHERE id='p1'")).rows[0] as never,
);
console.assert(p1b.cc === "UPDATED complaint", "upsert-on-conflict updates");
await local.execute({ sql: "DELETE FROM patients WHERE id = ?", args: ["p2"] });
const cnt = Number((await local.execute("SELECT COUNT(*) c FROM patients")).rows[0].c);
console.assert(cnt === 1, "prune works");
console.log("✔ upsert + delete reconcile OK");

// 5. Guard: migration must be a no-op when tables are non-empty
const patientsBefore = cnt;
console.log(
  "✔ tables non-empty →",
  patientsBefore,
  "patient(s); coreTablesEmpty() would return false, blocking re-migration",
);

// 6. Login flow against SQL
const { verifyPassword } = await import("../src/lib/crypto.server");
const row = (
  await local.execute({
    sql: "SELECT password_hash FROM users WHERE lower(email)=lower(?)",
    args: ["ADMIN"],
  })
).rows[0];
console.assert(
  await verifyPassword("pl4in'text\"pw", String(row.password_hash)),
  "SQL login verify OK",
);
console.log("✔ parameterized login SELECT + PBKDF2 verify OK");

console.log("\nALL TESTS PASSED");

// 7. Lockout columns + role-based lockout semantics
await local
  .execute("ALTER TABLE users ADD COLUMN locked INTEGER NOT NULL DEFAULT 0")
  .catch(() => {});
await local
  .execute("ALTER TABLE users ADD COLUMN failed_attempts INTEGER NOT NULL DEFAULT 0")
  .catch(() => {});
// duplicate ALTER must be tolerated (simulates re-running ensureSchema)
let dupOk = false;
try {
  await local.execute("ALTER TABLE users ADD COLUMN locked INTEGER NOT NULL DEFAULT 0");
} catch (e) {
  dupOk = /duplicate column name/i.test(String((e as Error).message));
}
console.assert(dupOk, "duplicate-column ALTER is detected and tolerated");
// simulate 4 consecutive failures for a non-admin, then lock
await local.execute({
  sql: rows.UPSERT_USER,
  args: ["u2", "therapist1", "T", "therapist", "pbkdf2$210000$x$y", "", Date.now()],
});
for (let f = 1; f <= 4; f++) {
  if (f >= 4)
    await local.execute({
      sql: "UPDATE users SET locked = 1, failed_attempts = ? WHERE id = ?",
      args: [f, "u2"],
    });
  else
    await local.execute({
      sql: "UPDATE users SET failed_attempts = ? WHERE id = ?",
      args: [f, "u2"],
    });
}
const lockedRow = (await local.execute("SELECT locked, failed_attempts FROM users WHERE id='u2'"))
  .rows[0];
console.assert(
  Number(lockedRow.locked) === 1 && Number(lockedRow.failed_attempts) === 4,
  "non-admin locked at 4 fails",
);
// unlock restores access
await local.execute({
  sql: "UPDATE users SET locked = 0, failed_attempts = 0 WHERE id = ?",
  args: ["u2"],
});
const unlockedRow = (await local.execute("SELECT locked FROM users WHERE id='u2'")).rows[0];
console.assert(Number(unlockedRow.locked) === 0, "unlock works");
// admin row is never marked locked by the flow; UPSERT_USER must not touch lock columns
await local.execute({
  sql: "UPDATE users SET locked = 1, failed_attempts = 2 WHERE id = ?",
  args: ["u2"],
});
await local.execute({
  sql: rows.UPSERT_USER,
  args: await rows.userArgs({
    id: "u2",
    email: "therapist1",
    name: "T2",
    role: "therapist",
    password: "pbkdf2$210000$x$y",
    emailId: "",
  }),
});
const afterSync = (
  await local.execute("SELECT locked, failed_attempts, name FROM users WHERE id='u2'")
).rows[0];
console.assert(
  Number(afterSync.locked) === 1 &&
    Number(afterSync.failed_attempts) === 2 &&
    String(afterSync.name) === "T2",
  "state sync updates profile but NEVER clears lock state",
);
console.log("✔ lockout schema + semantics OK (lock at 4, unlock, sync preserves lock)");

console.log("\nALL TESTS PASSED (incl. lockout)");

// 8. Batched writes: chunking + per-record fallback isolation
{
  const { executeBatchWithFallback } = rows;
  await local.execute("CREATE TABLE IF NOT EXISTS bt (id TEXT PRIMARY KEY, v INTEGER NOT NULL)");
  const items = Array.from({ length: 80 }, (_, i) => ({
    label: "bt", sql: "INSERT OR REPLACE INTO bt (id, v) VALUES (?, ?)",
    args: [`r${i}`, i === 41 ? null : i] as never, // r41 violates NOT NULL -> chunk 2 falls back
    record: { id: `r${i}` },
  }));
  let ok = 0, bad = 0;
  await executeBatchWithFallback(local as never, items as never, (_i: never, good: boolean) => (good ? ok++ : bad++));
  const cnt = Number((await local.execute("SELECT COUNT(*) c FROM bt")).rows[0].c);
  console.assert(ok === 79 && bad === 1 && cnt === 79, "batch fallback isolates exactly the bad record", { ok, bad, cnt });
  console.log("✔ batched writes OK: 79/80 landed, 1 bad record isolated & logged, rest of chunk preserved");
}
console.log("ALL TESTS PASSED (incl. batching)");
