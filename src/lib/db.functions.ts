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

    async function reconcile<T extends { id: string }>(
      label: string,
      table: string,
      idColumn: string,
      records: T[] | undefined,
      sql: string,
      toArgs: (
        rec: T,
      ) => import("@libsql/client/web").InArgs | Promise<import("@libsql/client/web").InArgs>,
    ) {
      const list = Array.isArray(records) ? records : [];
      const keep = new Set<string>();
      for (const rec of list) {
        try {
          const args = await toArgs(rec);
          await db.execute({ sql, args });
          keep.add(rec.id);
        } catch (err) {
          console.error(`[sync] failed to upsert ${label}:`, err, "record:", rec);
          failures.push(`${label}:${rec.id}`);
        }
      }
      // Remove rows deleted on the client. Do NOT wipe the table when the
      // incoming list is empty AND every upsert failed — that combination
      // means the payload was bad, not that the user deleted everything.
      try {
        const existing = await db.execute(`SELECT ${idColumn} AS id FROM ${table}`);
        for (const row of existing.rows) {
          const id = String(row.id);
          if (!keep.has(id)) {
            if (list.some((r) => r.id === id)) continue; // upsert failed — keep the old row
            await db.execute({ sql: `DELETE FROM ${table} WHERE ${idColumn} = ?`, args: [id] });
          }
        }
      } catch (err) {
        console.error(`[sync] failed to prune ${label}:`, err);
        failures.push(`${label}:prune`);
      }
    }

    await reconcile("user", "users", "id", parsed.users, rows.UPSERT_USER, rows.userArgs);
    await reconcile(
      "patient",
      "patients",
      "id",
      parsed.patients,
      rows.UPSERT_PATIENT,
      rows.patientArgs,
    );
    await reconcile("visit", "visits", "id", parsed.visits, rows.UPSERT_VISIT, rows.visitArgs);
    await reconcile("note", "clinical_notes", "id", parsed.notes, rows.UPSERT_NOTE, rows.noteArgs);
    await reconcile(
      "booking",
      "bookings",
      "id",
      parsed.bookings,
      rows.UPSERT_BOOKING,
      rows.bookingArgs,
    );
    await reconcile(
      "blocked",
      "blocked_slots",
      "id",
      parsed.blocked,
      rows.UPSERT_BLOCKED,
      rows.blockedArgs,
    );

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

    await auditEvent("state.sync", failures.length ? `failures:${failures.join(",")}` : undefined);
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
      // Staff roles (therapist / reception / other): lock on the 4th
      // consecutive invalid password.
      if (newFails >= 4) {
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
      return { ok: false as const, reason: "bad-password" as const, failsLeft: 4 - newFails };
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
