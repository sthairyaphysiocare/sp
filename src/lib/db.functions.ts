import { createServerFn } from "@tanstack/react-start";

/**
 * Server functions — the ONLY bridge between the browser and Turso.
 *
 * Storage layout (post-cutover):
 * - Normalized, statically-defined tables: users, patients, visits,
 *   clinical_notes, bookings, blocked_slots, app_settings, audit_log.
 * - Every write is a parameterized query. No dynamic SQL generation.
 * - localStorage is no longer a storage tier; it is read exactly once as a
 *   migration source when the cloud database is empty.
 * - User passwords are PBKDF2-SHA256 hashed before they touch the database.
 */

/** Load the full app snapshot from the normalized tables. */
export const loadSnapshot = createServerFn({ method: "GET" }).handler(async () => {
  const { readSnapshot } = await import("./turso.server");
  try {
    return await readSnapshot();
  } catch (err) {
    console.error("[db.functions] loadSnapshot failed:", err);
    throw err;
  }
});

/**
 * Persist the client's authoritative state into the normalized tables.
 * For each entity type: upsert every record individually (parameterized),
 * then delete rows whose ids are no longer present. A single bad record is
 * logged with its data and skipped — the rest of the sync continues.
 */
export const syncState = createServerFn({ method: "POST" })
  .inputValidator((input: { data: string; deletes?: Record<string, string[]> }) => {
    if (!input || typeof input.data !== "string") throw new Error("Invalid payload");
    if (input.data.length > 8 * 1024 * 1024) throw new Error("State payload too large");
    // `deletes` is optional so an older client (or a cached tab mid-deploy)
    // still syncs correctly — it simply deletes nothing, which is the safe
    // direction to fail in.
    if (input.deletes !== undefined) {
      if (
        typeof input.deletes !== "object" ||
        input.deletes === null ||
        Array.isArray(input.deletes)
      )
        throw new Error("Invalid deletes");
      for (const ids of Object.values(input.deletes)) {
        if (!Array.isArray(ids) || ids.some((i) => typeof i !== "string"))
          throw new Error("Invalid deletes");
      }
    }
    return input;
  })
  .handler(async ({ data }) => {
    const { turso, ensureSchema, auditEvent } = await import("./turso.server");
    const rows = await import("./db.rows.server");
    type Blob = import("./db.rows.server").LegacyBlobShape;

    let parsed: Blob;
    try {
      parsed = JSON.parse(data.data) as Blob;
    } catch (err) {
      console.error("[db.functions] syncState received invalid JSON:", err);
      throw new Error("Invalid state payload");
    }

    await ensureSchema();
    const db = turso();

    const failures: string[] = [];

    // ------------------------------------------------------------------
    // Batched reconcile. Every client.execute() is one Workers subrequest
    // (capped at 50/request on the free plan), so with real data volumes a
    // per-record loop dies mid-sync. Instead:
    //   1 batch  -> read existing ids of all six tables
    //   N/35     -> chunked upsert batches across ALL tables combined
    //   1 batch  -> all deletes for client-removed rows
    // A failing chunk falls back to per-record execution so one bad record
    // is logged with its data and skipped without aborting the sync.
    // ------------------------------------------------------------------
    type Entity = { id: string };
    interface Spec {
      label: string;
      table: string;
      records: Entity[];
      sql: string;
      toArgs: (
        rec: never,
      ) => import("@libsql/client/web").InArgs | Promise<import("@libsql/client/web").InArgs>;
    }
    const specs: Spec[] = [
      {
        label: "user",
        table: "users",
        records: parsed.users ?? [],
        sql: rows.UPSERT_USER,
        toArgs: rows.userArgs as never,
      },
      {
        label: "patient",
        table: "patients",
        records: parsed.patients ?? [],
        sql: rows.UPSERT_PATIENT,
        toArgs: rows.patientArgs as never,
      },
      {
        label: "visit",
        table: "visits",
        records: parsed.visits ?? [],
        sql: rows.UPSERT_VISIT,
        toArgs: rows.visitArgs as never,
      },
      {
        label: "note",
        table: "clinical_notes",
        records: parsed.notes ?? [],
        sql: rows.UPSERT_NOTE,
        toArgs: rows.noteArgs as never,
      },
      {
        label: "booking",
        table: "bookings",
        records: parsed.bookings ?? [],
        sql: rows.UPSERT_BOOKING,
        toArgs: rows.bookingArgs as never,
      },
      {
        label: "blocked",
        table: "blocked_slots",
        records: parsed.blocked ?? [],
        sql: rows.UPSERT_BLOCKED,
        toArgs: rows.blockedArgs as never,
      },
    ];

    // 1. Existing ids (single batch).
    const idResults = await db.batch(
      specs.map((sp) => `SELECT id FROM ${sp.table}`),
      "read",
    );
    const existingIds = idResults.map((r) => new Set(r.rows.map((row) => String(row.id))));

    // 2. Prepare and run all upserts in shared chunks.
    const items: import("./db.rows.server").BatchItem[] = [];
    const okIds = specs.map(() => new Set<string>());
    const itemMeta: Array<{ specIdx: number; id: string }> = [];
    for (let si = 0; si < specs.length; si++) {
      const sp = specs[si];
      for (const rec of Array.isArray(sp.records) ? sp.records : []) {
        try {
          items.push({
            label: sp.label,
            sql: sp.sql,
            args: await sp.toArgs(rec as never),
            record: rec,
          });
          itemMeta.push({ specIdx: si, id: rec.id });
        } catch (err) {
          console.error(
            `[sync] failed to prepare ${sp.label}:`,
            err,
            "record:",
            rows.redactSensitive(rec),
          );
          failures.push(`${sp.label}:${rec.id}`);
        }
      }
    }
    let itemIdx = 0;
    await rows.executeBatchWithFallback(db, items, (item, ok) => {
      const meta = itemMeta[itemIdx++];
      if (ok) okIds[meta.specIdx].add(meta.id);
      else failures.push(`${item.label}:${meta.id}`);
    });

    // 3. Deletes — ONLY ids the client explicitly said the user deleted.
    //
    // This previously inferred deletions: every existing row whose id was
    // absent from the payload was deleted. That treats "absent" and "deleted"
    // as the same thing, and they are not. A client holding partial, stale or
    // empty state therefore meant "remove everything I am not holding", which
    // destroyed the clinic's live patient records on several occasions.
    //
    // Nothing is now removed unless the user removed it. An id reaches this
    // list only from an explicit delete action in the UI. A payload that is
    // simply missing records — for any reason, including bugs elsewhere —
    // deletes nothing.
    //
    // Guarded further: an id is only deleted if it is genuinely absent from
    // the records just sent, so a record that is both present and listed for
    // deletion (which should never happen) is kept rather than removed.
    const requestedDeletes = data.deletes ?? {};
    const deletes: Array<{ sql: string; args: import("@libsql/client/web").InArgs }> = [];
    const appliedDeletes: string[] = [];
    for (let si = 0; si < specs.length; si++) {
      const sp = specs[si];
      const requested = requestedDeletes[sp.table] ?? [];
      if (requested.length === 0) continue;
      const sent = new Set((sp.records ?? []).map((r) => r.id));
      for (const id of requested) {
        if (!existingIds[si].has(id)) continue; // already gone — nothing to do
        if (sent.has(id)) continue; // still present in state — do not delete
        deletes.push({ sql: `DELETE FROM ${sp.table} WHERE id = ?`, args: [id] });
        appliedDeletes.push(`${sp.table}:${id}`);

        // Cascade a patient deletion to that patient's visits and notes,
        // server-side and by patient_id.
        //
        // The client used to enumerate those child ids itself, which only
        // worked while every visit and note was held in memory. As those
        // tables move to being loaded on demand (so the app can scale to tens
        // of thousands of patients), the client can no longer see them — and
        // enumerating from a partial view would silently orphan the rows it
        // could not see.
        //
        // This stays consistent with "nothing is deleted unless a user
        // deletes it": it fires only for a patient id the user explicitly
        // deleted, and removes only rows belonging to that patient. It cannot
        // widen to anything else.
        if (sp.table === "patients") {
          // Bounded by patient_id, so each statement can only ever touch one
          // patient's children. Noted explicitly because the mass-delete
          // breaker below counts STATEMENTS, not rows: a patient-scoped
          // cascade is deliberately exempt from that accounting, since its
          // blast radius is limited by construction to rows belonging to a
          // patient the user just deleted. It cannot widen to a whole table
          // the way an unscoped prune could.
          deletes.push({ sql: `DELETE FROM visits WHERE patient_id = ?`, args: [id] });
          deletes.push({ sql: `DELETE FROM clinical_notes WHERE patient_id = ?`, args: [id] });
          appliedDeletes.push(`cascade:${id}`);
        }
      }
    }

    // ---- MASS-DELETE CIRCUIT BREAKER -------------------------------------
    // Refuse any sync that would remove a large share of an existing table.
    //
    // This exists because the clinic's live data was destroyed repeatedly: the
    // client would end up holding seed/sample state and push it, and this
    // prune step faithfully deleted every real patient, visit and note that
    // was "missing" from that payload. Client-side guards were added for the
    // known path, but a guess at the client path is not a guarantee — this is
    // the one place every destructive delete must pass through, whatever
    // caused it, so the stop belongs here.
    //
    // The rule: a table that currently holds rows may not lose most of them in
    // a single sync. Real usage deletes a patient or a booking at a time; only
    // a state reset removes nearly everything at once. Deliberately generous
    // so ordinary bulk edits are unaffected, and only engaged for tables with
    // enough rows that "most of them" is meaningful — a 2-row table legitimately
    // going to 0 is not evidence of anything.
    const MASS_DELETE_MIN_ROWS = 5; // below this, proportion is meaningless
    const MASS_DELETE_RATIO = 0.5; // never drop >50% of an established table
    const blocked: string[] = [];
    for (let si = 0; si < specs.length; si++) {
      const sp = specs[si];
      const existing = existingIds[si].size;
      if (existing < MASS_DELETE_MIN_ROWS) continue;
      // Count only id-scoped deletes. Patient-scoped cascades
      // (DELETE ... WHERE patient_id = ?) are excluded deliberately: they are
      // bounded to one patient's children by construction, and counting them
      // here would be meaningless anyway since one statement removes an
      // unknown number of rows.
      const removing = deletes.filter(
        (d) => d.sql.includes(`FROM ${sp.table} `) && d.sql.includes("WHERE id = ?"),
      ).length;
      if (removing > existing * MASS_DELETE_RATIO) {
        blocked.push(`${sp.table}:${removing}/${existing}`);
      }
    }
    if (blocked.length > 0) {
      // Abort the whole sync, not just the deletes: a payload this wrong is
      // not trustworthy for its upserts either. Upserts already applied are
      // non-destructive (they only add/overwrite by id), and the rows that
      // matter are still on disk.
      console.error(
        "[sync] BLOCKED: refusing a mass delete. This payload would remove most of",
        blocked.join(", "),
        "- rejecting it as a probable client state reset. No rows were deleted.",
      );
      await auditEvent("state.sync.blocked_mass_delete", blocked.join(","));
      return { ok: false as const, failures: [`blocked-mass-delete:${blocked.join(",")}`] };
    }

    if (deletes.length > 0) {
      try {
        await db.batch(deletes, "write");
      } catch (err) {
        console.error("[sync] delete batch failed:", err);
        failures.push("prune:batch");
      }
    }

    if (parsed.settings) {
      try {
        // app_settings is one row replaced wholesale, so it has no per-record
        // delete protection like the tables above. Two safeguards apply here
        // instead.
        const prev = await db.execute({
          sql: "SELECT data FROM app_settings WHERE id = ?",
          args: ["main"],
        });
        const prevRaw = prev.rows[0] ? String(prev.rows[0].data) : null;

        // SAFEGUARD 1 — refuse a write that would wipe a configured clinic.
        //
        // Branches, clinicians and specialities are the substance of the
        // settings blob. A payload that empties ALL of them at once, against
        // stored settings that had them, is never a real user action: the UI
        // deletes these one at a time, and a clinic cannot operate with zero
        // branches. It is the signature of default/partial state being
        // written over real configuration - the same failure that repeatedly
        // destroyed the patient tables.
        //
        // Deliberately narrow: emptying ALL THREE simultaneously is required,
        // so deleting the last speciality (or clinician, or branch)
        // individually still works exactly as before.
        if (prevRaw) {
          try {
            const before = JSON.parse(prevRaw) as Record<string, unknown[]>;
            const after = parsed.settings as unknown as Record<string, unknown[]>;
            const count = (o: Record<string, unknown[]>, k: string) =>
              Array.isArray(o?.[k]) ? o[k].length : 0;
            const hadContent =
              count(before, "branches") +
                count(before, "clinicians") +
                count(before, "specialities") >
              0;
            const wipesAll =
              count(after, "branches") === 0 &&
              count(after, "clinicians") === 0 &&
              count(after, "specialities") === 0;
            if (hadContent && wipesAll) {
              console.error(
                "[sync] BLOCKED: refusing a settings write that would empty branches, clinicians AND specialities at once. Treating it as default/partial state overwriting real configuration.",
              );
              await auditEvent("settings.blocked_wipe", "all-collections-emptied");
              failures.push("settings:blocked-wipe");
              throw new Error("settings-wipe-blocked");
            }
          } catch (err) {
            // A parse failure on the PREVIOUS value must not block a
            // legitimate write; only the explicit block above should.
            if (err instanceof Error && err.message === "settings-wipe-blocked") throw err;
          }
        }

        // SAFEGUARD 2 — archive the previous value before replacing it, so a
        // bad write is always recoverable rather than silently final.
        if (prevRaw) {
          try {
            await db.execute({
              sql: "INSERT INTO app_settings_history (data, archived_at) VALUES (?, ?)",
              args: [prevRaw, Date.now()],
            });
            // Keep the history bounded; pruning is by count only and never
            // driven by anything the client sends.
            await db.execute({
              sql: `DELETE FROM app_settings_history WHERE id NOT IN (
                      SELECT id FROM app_settings_history ORDER BY id DESC LIMIT 50)`,
              args: [],
            });
          } catch (err) {
            // Archiving is best-effort: never block a legitimate settings
            // save because the history write failed.
            console.error("[sync] settings history archive failed:", err);
          }
        }

        await db.execute({
          sql: rows.UPSERT_SETTINGS,
          args: ["main", JSON.stringify(parsed.settings), Date.now()],
        });
      } catch (err) {
        if (!(err instanceof Error && err.message === "settings-wipe-blocked")) {
          console.error("[sync] failed to upsert settings:", err);
          failures.push("settings:main");
        }
      }
    }

    // Audit policy: routine state syncs are NOT logged (they are the highest
    // volume event); only sync failures are recorded. Security- and
    // clinically-sensitive events (auth, lockouts, prescriptions, migration)
    // keep their dedicated audit entries.
    if (failures.length > 0) {
      await auditEvent("state.sync.failures", failures.join(","));
    }
    return { ok: true as const, failures };
  });

/**
 * One-time migration entry point: the browser sends its legacy localStorage
 * blob; the server inserts it record-by-record — ONLY if the tables are empty.
 */
export const migrateLocalStorageToTurso = createServerFn({ method: "POST" })
  .inputValidator((input: { data: string }) => {
    if (!input || typeof input.data !== "string") throw new Error("Invalid payload");
    if (input.data.length > 8 * 1024 * 1024) throw new Error("Payload too large");
    return input;
  })
  .handler(async ({ data }) => {
    const { migrateLocalStorageBlob, auditEvent } = await import("./turso.server");
    try {
      const report = await migrateLocalStorageBlob(data.data);
      await auditEvent("migration.localStorage", JSON.stringify(report));
      return report;
    } catch (err) {
      console.error("[db.functions] localStorage migration failed:", err);
      throw err;
    }
  });

/**
 * Verify a login credential server-side with a parameterized SELECT against
 * the users table. Returns the matching user id (never the hash) or a reason.
 */
export const verifyLogin = createServerFn({ method: "POST" })
  .inputValidator((input: { username: string; password: string }) => {
    if (!input || typeof input.username !== "string" || typeof input.password !== "string") {
      throw new Error("Invalid credentials");
    }
    return input;
  })
  .handler(async ({ data }) => {
    const { turso, ensureSchema, auditEvent, migrateAppStateIfNeeded } =
      await import("./turso.server");
    const { verifyPassword, isHashed } = await import("./crypto.server");
    await ensureSchema();
    await migrateAppStateIfNeeded();
    const db = turso();

    const res = await db.execute({
      sql: "SELECT id, role, password_hash, locked, failed_attempts FROM users WHERE lower(email) = lower(?) LIMIT 1",
      args: [data.username],
    });
    const row = res.rows[0];
    if (!row) {
      const count = await db.execute("SELECT COUNT(*) AS c FROM users");
      if (Number(count.rows[0]?.c ?? 0) === 0) {
        // Fresh database with no users yet — let the client fall back to
        // its local seed accounts (first-run experience).
        return { ok: false as const, reason: "no-state" as const };
      }
      await auditEvent("auth.fail", `unknown:${data.username}`);
      return { ok: false as const, reason: "not-found" as const };
    }

    const userId = String(row.id);
    const isAdmin = String(row.role) === "admin";
    const fails = Number(row.failed_attempts ?? 0);

    // Non-admin accounts stay locked (even with the right password) until an
    // admin unlocks them. Admin accounts are NEVER locked.
    if (!isAdmin && Number(row.locked ?? 0) === 1) {
      await auditEvent("auth.fail", `locked:${userId}`);
      return { ok: false as const, reason: "account-locked" as const };
    }

    const stored = String(row.password_hash ?? "");
    const match = isHashed(stored)
      ? await verifyPassword(data.password, stored)
      : stored.length > 0 && stored === data.password; // legacy plaintext row (pre-hash migration)

    if (!match) {
      const newFails = fails + 1;
      if (isAdmin) {
        // Admin exemption: never lock. Instead, apply a progressive
        // artificial delay (2s, 4s, 6s… capped at 10s) so brute-forcing the
        // admin password is impractically slow.
        const delayMs = Math.min(2000 * newFails, 10_000);
        await db.execute({
          sql: "UPDATE users SET failed_attempts = ? WHERE id = ?",
          args: [newFails, userId],
        });
        await auditEvent("auth.fail", `bad-pw-admin:${userId}:delay${delayMs}ms`);
        await new Promise((r) => setTimeout(r, delayMs));
        return { ok: false as const, reason: "bad-password" as const };
      }
      // Staff roles (therapist / reception / other): lock on the 3rd
      // consecutive invalid password.
      if (newFails >= 3) {
        await db.execute({
          sql: "UPDATE users SET locked = 1, failed_attempts = ? WHERE id = ?",
          args: [newFails, userId],
        });
        await auditEvent("auth.lock", userId);
        return { ok: false as const, reason: "account-locked" as const };
      }
      await db.execute({
        sql: "UPDATE users SET failed_attempts = ? WHERE id = ?",
        args: [newFails, userId],
      });
      await auditEvent("auth.fail", `bad-pw:${userId}`);
      return { ok: false as const, reason: "bad-password" as const, failsLeft: 3 - newFails };
    }

    // Successful login resets the consecutive-failure counter.
    if (fails > 0) {
      await db.execute({
        sql: "UPDATE users SET failed_attempts = 0 WHERE id = ?",
        args: [userId],
      });
    }
    await auditEvent("auth.ok", userId);
    // Issue a signed token the SERVER can verify on later requests. Purely
    // additive: login behaves exactly as before and still succeeds if no
    // SESSION_SECRET is configured — the token is simply null, and protected
    // actions then deny rather than allow.
    const { issueSessionToken } = await import("./sessionToken.server");
    const token = await issueSessionToken(userId, String(row.role ?? "other"));
    return { ok: true as const, userId, token };
  });

/**
 * Fresh-from-database list of locked staff accounts, so the admin's
 * Staff & Roles page reflects locks that happened after it was hydrated.
 */
export const listLockedUsers = createServerFn({ method: "GET" }).handler(async () => {
  const { turso, ensureSchema } = await import("./turso.server");
  await ensureSchema();
  const db = turso();
  const res = await db.execute(
    "SELECT id, email, name, role FROM users WHERE locked = 1 AND role != 'admin'",
  );
  return res.rows.map((r) => ({
    id: String(r.id),
    email: String(r.email ?? ""),
    name: String(r.name ?? ""),
    role: String(r.role ?? "other"),
  }));
});

/**
 * Clear an account lockout (admin action from Staff & Roles, or automatic
 * after a successful OTP password reset, which proves account ownership).
 */
export const unlockUser = createServerFn({ method: "POST" })
  .inputValidator((input: { userId: string }) => {
    if (!input || typeof input.userId !== "string" || !input.userId)
      throw new Error("Invalid payload");
    return input;
  })
  .handler(async ({ data }) => {
    const { turso, ensureSchema, auditEvent } = await import("./turso.server");
    await ensureSchema();
    const db = turso();
    await db.execute({
      sql: "UPDATE users SET locked = 0, failed_attempts = 0 WHERE id = ?",
      args: [data.userId],
    });
    await auditEvent("auth.unlock", data.userId);
    return { ok: true as const };
  });

/**
 * Chronological (newest-first) list of saved prescriptions for one patient,
 * used by the Prescription History tab on the patient profile.
 */
export const listPrescriptions = createServerFn({ method: "POST" })
  .inputValidator((input: { patientId: string }) => {
    if (!input || typeof input.patientId !== "string" || !input.patientId) {
      throw new Error("Invalid payload");
    }
    return input;
  })
  .handler(async ({ data }) => {
    const { turso, ensureSchema } = await import("./turso.server");
    await ensureSchema();
    const db = turso();
    const res = await db.execute({
      sql: `SELECT id, receipt_no, data, created_at FROM prescriptions
            WHERE patient_id = ? ORDER BY created_at DESC`,
      args: [data.patientId],
    });
    return res.rows.map((r) => ({
      id: String(r.id),
      receiptNo: r.receipt_no == null ? null : String(r.receipt_no),
      data: String(r.data),
      createdAt: Number(r.created_at ?? 0),
    }));
  });

/**
 * Persist a prescription (and its receipt) to the database. When the
 * prescription includes a receipt, a sequential receipt number is allocated
 * atomically: SP-000001, SP-000002, ... The number survives retries because
 * the counter row is bumped in a single UPSERT...RETURNING statement.
 */
export const savePrescription = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { patientId: string; hasReceipt: boolean; data: string; createdBy?: string }) => {
      if (!input || typeof input.patientId !== "string" || typeof input.data !== "string") {
        throw new Error("Invalid payload");
      }
      if (input.data.length > 512 * 1024) throw new Error("Prescription payload too large");
      return input;
    },
  )
  .handler(async ({ data }) => {
    const { turso, ensureSchema, auditEvent } = await import("./turso.server");
    await ensureSchema();
    const db = turso();

    let receiptNo: string | null = null;
    if (data.hasReceipt) {
      const res = await db.execute({
        sql: `INSERT INTO counters (name, value) VALUES ('receipt', 1)
              ON CONFLICT(name) DO UPDATE SET value = value + 1
              RETURNING value`,
        args: [],
      });
      const n = Number(res.rows[0]?.value ?? 0);
      receiptNo = `SP-${String(n).padStart(6, "0")}`;
    }

    const id = `rx${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
    await db.execute({
      sql: `INSERT INTO prescriptions (id, patient_id, receipt_no, data, created_by, created_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [id, data.patientId, receiptNo, data.data, data.createdBy ?? "", Date.now()],
    });
    await auditEvent("prescription.save", `${id}${receiptNo ? `:${receiptNo}` : ""}`);
    return { ok: true as const, id, receiptNo };
  });

/**
 * Notify the clinic that a public booking arrived.
 *
 * Server-side so the email provider's API key is never exposed in the browser.
 * Always resolves — the booking is already saved by the time this runs, and a
 * notification problem must never surface to the visitor or suggest their
 * booking failed. Input is validated and length-capped so this cannot be used
 * as an open relay for arbitrary content.
 */
export const notifyBooking = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      toEmail: string;
      patientName: string;
      phone: string;
      patientEmail: string;
      concern: string;
      when: string;
      branch: string;
    }) => {
      if (!input || typeof input !== "object") throw new Error("Invalid payload");
      const cap = (v: unknown, max: number) => String(v ?? "").slice(0, max);
      return {
        toEmail: cap(input.toEmail, 200),
        patientName: cap(input.patientName, 120),
        phone: cap(input.phone, 40),
        patientEmail: cap(input.patientEmail, 200),
        concern: cap(input.concern, 2000),
        when: cap(input.when, 120),
        branch: cap(input.branch, 120),
      };
    },
  )
  .handler(async ({ data }) => {
    const { sendBookingNotification } = await import("./bookingEmail.server");
    const res = await sendBookingNotification(data);
    if (!res.ok && !res.skipped) {
      console.error("[notifyBooking] failed:", res.error);
    }
    return res;
  });

/**
 * Fetch one patient with their visits and notes.
 *
 * The initial snapshot loads a bounded window of patients, so an older record
 * would otherwise be unreachable once the archive grows past it. Read-only —
 * it cannot create, modify or remove anything.
 */
export const fetchPatientBundle = createServerFn({ method: "GET" })
  .inputValidator((input: { id: string }) => {
    if (!input || typeof input.id !== "string" || !input.id) throw new Error("Invalid id");
    return { id: input.id.slice(0, 120) };
  })
  .handler(async ({ data }) => {
    const { readPatientBundle } = await import("./turso.server");
    try {
      return await readPatientBundle(data.id);
    } catch (err) {
      console.error("[fetchPatientBundle] failed:", err);
      return { patient: null, visits: [], notes: [] };
    }
  });

/**
 * Search patients across the whole table rather than the loaded window, so
 * search keeps finding older records at any archive size. Read-only.
 */
export const searchPatients = createServerFn({ method: "GET" })
  .inputValidator((input: { q: string }) => {
    if (!input || typeof input.q !== "string") throw new Error("Invalid query");
    return { q: input.q.slice(0, 120) };
  })
  .handler(async ({ data }) => {
    const { searchPatientsServer } = await import("./turso.server");
    try {
      return { patients: await searchPatientsServer(data.q) };
    } catch (err) {
      console.error("[searchPatients] failed:", err);
      return { patients: [] };
    }
  });

/**
 * One page of patients, sorted and filtered across the whole table.
 *
 * Lets the patients list sort the entire clinic rather than only the loaded
 * snapshot window. Read-only, and every input is validated and bounded: the
 * sort key is resolved against a fixed allowlist server-side, so it can never
 * reach the SQL string.
 */
export const fetchPatientsPage = createServerFn({ method: "GET" })
  .inputValidator((input: { sort?: string; q?: string; offset?: number; limit?: number }) => {
    if (!input || typeof input !== "object") throw new Error("Invalid payload");
    const n = (v: unknown, dflt: number) => (Number.isFinite(Number(v)) ? Number(v) : dflt);
    return {
      sort: typeof input.sort === "string" ? input.sort.slice(0, 32) : "recent",
      q: typeof input.q === "string" ? input.q.slice(0, 120) : "",
      offset: Math.max(0, Math.floor(n(input.offset, 0))),
      limit: Math.min(200, Math.max(1, Math.floor(n(input.limit, 20)))),
    };
  })
  .handler(async ({ data }) => {
    const { listPatientsPage } = await import("./turso.server");
    try {
      return await listPatientsPage(data);
    } catch (err) {
      console.error("[fetchPatientsPage] failed:", err);
      // Signalled rather than thrown, so the list can fall back to its
      // in-memory view instead of rendering an error.
      return { patients: [], total: -1 };
    }
  });

// ---------------------------------------------------------------------------
// Gallery
//
// Every function that changes anything requires a signed session token
// belonging to an admin. The token is minted server-side at login and
// verified here against SESSION_SECRET, so a caller cannot forge one or
// promote themselves by editing what the browser stores. A UI check alone
// would be decoration: these endpoints are reachable directly.
//
// Reads are public by design — the gallery is published to visitors — but the
// public read returns only items marked visible, and only when the gallery is
// switched on.
// ---------------------------------------------------------------------------

/** Shared guard. Returns the admin's claims, or null to deny. */
async function requireAdmin(token: unknown) {
  const { verifyAdmin } = await import("./sessionToken.server");
  return verifyAdmin(token);
}

const capStr = (v: unknown, max: number) => String(v ?? "").slice(0, max);

/**
 * What the public site shows: visible items, and only when the gallery is on.
 *
 * Returns `enabled` so the nav link and the page can agree with each other
 * without a second round trip.
 */
export const fetchGallery = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { listGallery, galleryEnabled } = await import("./gallery.server");
    const enabled = await galleryEnabled();
    if (!enabled) return { enabled: false, items: [] };
    return { enabled: true, items: await listGallery(false) };
  } catch (err) {
    console.error("[fetchGallery] failed:", err);
    // A gallery that cannot be read simply does not appear; it must never
    // take the page down with it.
    return { enabled: false, items: [] };
  }
});

/**
 * Just the on/off flag.
 *
 * The header asks this on every public page to decide whether to show the
 * Gallery link, so it deliberately returns one boolean rather than the item
 * list — a nav link should not cost sixty rows.
 */
export const fetchGalleryStatus = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { galleryEnabled } = await import("./gallery.server");
    return { enabled: await galleryEnabled() };
  } catch {
    return { enabled: false };
  }
});

/** Everything, hidden items included. Admin only. */
export const fetchGalleryAdmin = createServerFn({ method: "POST" })
  .inputValidator((input: { token?: string }) => ({ token: capStr(input?.token, 4096) }))
  .handler(async ({ data }) => {
    if (!(await requireAdmin(data.token))) return { ok: false as const, reason: "forbidden" };
    try {
      const { listGallery, galleryEnabled } = await import("./gallery.server");
      return {
        ok: true as const,
        enabled: await galleryEnabled(),
        items: await listGallery(true),
      };
    } catch (err) {
      console.error("[fetchGalleryAdmin] failed:", err);
      return { ok: false as const, reason: "error" };
    }
  });

/**
 * A one-shot, server-signed permission slip for a single upload.
 *
 * The server chooses the folder and the filename; both are covered by the
 * signature, so the browser cannot redirect the upload elsewhere in the
 * account or overwrite an existing asset.
 */
export const galleryUploadTicket = createServerFn({ method: "POST" })
  .inputValidator((input: { token?: string; kind?: string }) => ({
    token: capStr(input?.token, 4096),
    kind: input?.kind === "video" ? ("video" as const) : ("image" as const),
  }))
  .handler(async ({ data }) => {
    if (!(await requireAdmin(data.token))) return { ok: false as const, reason: "forbidden" };
    const { signUploadTicket } = await import("./cloudinary.server");
    const { GALLERY_FOLDER, galleryCount, galleryVideoCount, MAX_ITEMS, MAX_VIDEOS } =
      await import("./gallery.server");
    try {
      // Checked before the upload as well as after it, so a full gallery
      // fails immediately instead of after the file has been sent and then
      // deleted again.
      if ((await galleryCount()) >= MAX_ITEMS) return { ok: false as const, reason: "full" };
      if (data.kind === "video" && (await galleryVideoCount()) >= MAX_VIDEOS) {
        return { ok: false as const, reason: "too-many-videos" };
      }
      const publicId = `gal_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      const ticket = await signUploadTicket({
        folder: GALLERY_FOLDER,
        publicId,
        kind: data.kind,
      });
      if (!ticket) return { ok: false as const, reason: "not-configured" };
      return { ok: true as const, ticket, publicId: `${GALLERY_FOLDER}/${publicId}` };
    } catch (err) {
      console.error("[galleryUploadTicket] failed:", err);
      return { ok: false as const, reason: "error" };
    }
  });

/** Record an upload after verifying with Cloudinary what was actually stored. */
export const galleryAdd = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      token?: string;
      publicId?: string;
      kind?: string;
      caption?: string;
      description?: string;
    }) => ({
      token: capStr(input?.token, 4096),
      publicId: capStr(input?.publicId, 300),
      kind: input?.kind === "video" ? ("video" as const) : ("image" as const),
      caption: capStr(input?.caption, 200),
      description: capStr(input?.description, 500),
    }),
  )
  .handler(async ({ data }) => {
    const claims = await requireAdmin(data.token);
    if (!claims) return { ok: false as const, reason: "forbidden" };
    try {
      const { addGalleryItem } = await import("./gallery.server");
      return await addGalleryItem({
        publicId: data.publicId,
        kind: data.kind,
        caption: data.caption,
        description: data.description,
        createdBy: claims.uid,
      });
    } catch (err) {
      console.error("[galleryAdd] failed:", err);
      return { ok: false as const, reason: "error" };
    }
  });

/** Edit caption, description or visibility of one item. */
export const galleryUpdate = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      token?: string;
      id?: string;
      caption?: string;
      description?: string;
      visible?: boolean;
    }) => ({
      token: capStr(input?.token, 4096),
      id: capStr(input?.id, 120),
      caption: input?.caption === undefined ? undefined : capStr(input.caption, 200),
      description: input?.description === undefined ? undefined : capStr(input.description, 500),
      visible: typeof input?.visible === "boolean" ? input.visible : undefined,
    }),
  )
  .handler(async ({ data }) => {
    if (!(await requireAdmin(data.token))) return { ok: false as const, reason: "forbidden" };
    try {
      const { updateGalleryItem } = await import("./gallery.server");
      const done = await updateGalleryItem(data.id, {
        caption: data.caption,
        description: data.description,
        visible: data.visible,
      });
      return done ? { ok: true as const } : { ok: false as const, reason: "not-found" };
    } catch (err) {
      console.error("[galleryUpdate] failed:", err);
      return { ok: false as const, reason: "error" };
    }
  });

/** Remove one item, and its Cloudinary asset with it. */
export const galleryDelete = createServerFn({ method: "POST" })
  .inputValidator((input: { token?: string; id?: string }) => ({
    token: capStr(input?.token, 4096),
    id: capStr(input?.id, 120),
  }))
  .handler(async ({ data }) => {
    const claims = await requireAdmin(data.token);
    if (!claims) return { ok: false as const, reason: "forbidden" };
    try {
      const { deleteGalleryItem } = await import("./gallery.server");
      const done = await deleteGalleryItem(data.id, claims.uid);
      return done ? { ok: true as const } : { ok: false as const, reason: "not-found" };
    } catch (err) {
      console.error("[galleryDelete] failed:", err);
      return { ok: false as const, reason: "error" };
    }
  });

/** Set the display order. Ids not listed keep their current position. */
export const galleryReorder = createServerFn({ method: "POST" })
  .inputValidator((input: { token?: string; ids?: unknown }) => ({
    token: capStr(input?.token, 4096),
    ids: Array.isArray(input?.ids)
      ? input.ids.slice(0, 200).map((v) => String(v).slice(0, 120))
      : [],
  }))
  .handler(async ({ data }) => {
    if (!(await requireAdmin(data.token))) return { ok: false as const, reason: "forbidden" };
    try {
      const { reorderGallery } = await import("./gallery.server");
      return { ok: true as const, moved: await reorderGallery(data.ids) };
    } catch (err) {
      console.error("[galleryReorder] failed:", err);
      return { ok: false as const, reason: "error" };
    }
  });

/** The master switch: whether the gallery appears on the public site at all. */
export const gallerySetEnabled = createServerFn({ method: "POST" })
  .inputValidator((input: { token?: string; enabled?: boolean }) => ({
    token: capStr(input?.token, 4096),
    enabled: input?.enabled === true,
  }))
  .handler(async ({ data }) => {
    const claims = await requireAdmin(data.token);
    if (!claims) return { ok: false as const, reason: "forbidden" };
    try {
      const { setGalleryEnabled } = await import("./gallery.server");
      await setGalleryEnabled(data.enabled, claims.uid);
      return { ok: true as const, enabled: data.enabled };
    } catch (err) {
      console.error("[gallerySetEnabled] failed:", err);
      return { ok: false as const, reason: "error" };
    }
  });
