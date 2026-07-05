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
  .inputValidator((input: { data: string }) => {
    if (!input || typeof input.data !== "string") throw new Error("Invalid payload");
    if (input.data.length > 8 * 1024 * 1024) throw new Error("State payload too large");
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

    // 3. Deletes for rows the client removed (single batch). A row whose
    //    upsert failed stays untouched — a bad payload must never wipe data.
    const deletes: Array<{ sql: string; args: import("@libsql/client/web").InArgs }> = [];
    for (let si = 0; si < specs.length; si++) {
      const sp = specs[si];
      const sent = new Set((sp.records ?? []).map((r) => r.id));
      for (const id of existingIds[si]) {
        if (!okIds[si].has(id) && !sent.has(id)) {
          deletes.push({ sql: `DELETE FROM ${sp.table} WHERE id = ?`, args: [id] });
        }
      }
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
        await db.execute({
          sql: rows.UPSERT_SETTINGS,
          args: ["main", JSON.stringify(parsed.settings), Date.now()],
        });
      } catch (err) {
        console.error("[sync] failed to upsert settings:", err);
        failures.push("settings:main");
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
    return { ok: true as const, userId };
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
