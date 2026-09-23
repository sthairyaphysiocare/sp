import { useSyncExternalStore } from "react";
import type {
  AppSettings,
  BlockedSlot,
  Booking,
  Branch,
  ClinicalNote,
  Clinician,
  Patient,
  PublicStats,
  SpecialityItem,
  User,
  Visit,
  Role,
  BranchHours,
  SocialLinks,
} from "./types";
import { DEFAULT_BRANCH, CLINIC } from "./logo";
import {
  loadSession as sessLoad,
  saveSession as sessSave,
  clearSession as sessClear,
  touchSession as sessTouch,
  registerLoginFailure,
  clearLoginFailures,
  lockoutRemainingMs,
} from "./session";

const KEY = "sthairya.db.v2";

interface DB {
  users: User[];
  patients: Patient[];
  visits: Visit[];
  notes: ClinicalNote[];
  bookings: Booking[];
  blocked: BlockedSlot[];
  settings: AppSettings;
  session: { userId: string | null };
}

const DEFAULT_USERS: User[] = [
  { id: "u1", email: "admin", name: "Admin", role: "admin", password: "password", emailId: "" },
  {
    id: "u2",
    email: "therapist",
    name: "Dr. Plinija",
    role: "therapist",
    password: "password",
    emailId: "",
  },
  {
    id: "u3",
    email: "reception",
    name: "Reception Desk",
    role: "reception",
    password: "password",
    emailId: "",
  },
];

export function DEFAULT_SOCIALS(): SocialLinks {
  // All platforms start disabled with empty URLs (admin opts in explicitly).
  return {
    youtube: { url: "", enabled: false },
    instagram: { url: "", enabled: false },
    facebook: { url: "", enabled: false },
    blog: { url: "", enabled: false },
  };
}

export const DEFAULT_HOURS: BranchHours = {
  mon: "9:00 AM – 1:00 PM & 4:00 PM – 8:00 PM",
  tue: "9:00 AM – 1:00 PM & 4:00 PM – 8:00 PM",
  wed: "9:00 AM – 1:00 PM & 4:00 PM – 8:00 PM",
  thu: "9:00 AM – 1:00 PM & 4:00 PM – 8:00 PM",
  fri: "9:00 AM – 1:00 PM & 4:00 PM – 8:00 PM",
  sat: "9:00 AM – 1:00 PM",
  sun: "By appointment",
};

const DEFAULT_STATS: PublicStats = {
  patients: "6+",
  years: "10+",
  recovery: "61%",
  programs: "20+",
};

const DEFAULT_SPECIALITIES: SpecialityItem[] = [
  {
    id: "sp1",
    icon: "Bone",
    title: "Back & Neck Pain",
    desc: "Targeted relief for spinal and postural dysfunction.",
  },
  {
    id: "sp2",
    icon: "Bandage",
    title: "Post-Operative Rehab",
    desc: "Structured recovery after TKR, ACL, and shoulder surgery.",
  },
  {
    id: "sp3",
    icon: "Dumbbell",
    title: "Sports Injuries",
    desc: "Performance-driven rehabilitation for athletes.",
  },
  {
    id: "sp4",
    icon: "Stethoscope",
    title: "Frozen Shoulder",
    desc: "Manual therapy and progressive ROM restoration.",
  },
  {
    id: "sp5",
    icon: "Accessibility",
    title: "Orthopaedic Conditions",
    desc: "Arthritis, tendinopathies, fractures, degenerative joints.",
  },
  {
    id: "sp6",
    icon: "Brain",
    title: "Neurological Rehab",
    desc: "Stroke recovery, Parkinson's, balance training.",
  },
  {
    id: "sp7",
    icon: "Footprints",
    title: "Gait & Posture",
    desc: "Gait analysis and biomechanical correction.",
  },
  {
    id: "sp8",
    icon: "Baby",
    title: "Paediatric & Geriatric",
    desc: "Developmental and mobility programs for all ages.",
  },
];

function defaultSettings(): AppSettings {
  return {
    publicStatsEnabled: false,
    branches: [{ ...DEFAULT_BRANCH, hours: { ...DEFAULT_HOURS }, emailId: "" }],
    whatsappNumber: CLINIC.whatsapp,
    globalEmail: "SthairyaPhysiocare@gmail.com",
    globalUrl: "",
    redirectUrl1: "",
    redirectUrl2: "",
    prescriptionUrl: "sthairyaphysiocare.pages.dev",
    prescriptionUrlEnabled: true,
    socials: DEFAULT_SOCIALS(),
    stats: { ...DEFAULT_STATS },
    specialities: DEFAULT_SPECIALITIES.map((s) => ({ ...s })),
    cliniciansEnabled: false,
    clinicians: [],
  };
}

/**
 * A structurally valid but completely EMPTY database.
 *
 * Used only when the real database could not be read. Deliberately contains
 * no users, no patients and no seeded settings: with no users, no login can
 * succeed; with no records, nothing can be mistaken for real clinic data;
 * and the mass-delete breaker on the server would reject it even if it
 * somehow reached a sync. It is the safe shape to hold when we know nothing.
 */
function emptyDb(): DB {
  return {
    users: [],
    patients: [],
    visits: [],
    notes: [],
    bookings: [],
    blocked: [],
    settings: defaultSettings(),
    session: { userId: null },
  };
}

/**
 * The state used for a genuinely empty database and for the SSR snapshot.
 *
 * Contains the default admin account and clinic settings so a fresh install
 * is usable and first-run login works — but NO patients and NO visits.
 *
 * Fabricated patient records used to be seeded here (seedPatients /
 * seedVisits: invented names, dates of birth, phone numbers and clinical
 * histories). That demo data is what repeatedly overwrote the clinic's real
 * records: whenever it was loaded and then synced, the server's prune step
 * deleted every genuine patient absent from it.
 *
 * Guards now prevent the sync paths that did that, but the deeper problem was
 * that convincing-looking fake patient records existed in the app at all. A
 * clinical system should never be able to invent a patient. With none to
 * invent, the worst case of any remaining bug is an empty screen rather than
 * a destroyed patient database.
 */
function defaultDb(): DB {
  return {
    users: DEFAULT_USERS,
    patients: [],
    visits: [],
    notes: [],
    bookings: [],
    blocked: [],
    settings: defaultSettings(),
    session: { userId: null },
  };
}

/**
 * Pure shape-repair: fills defaults for any missing/legacy fields so the UI
 * always sees a complete DB regardless of which era the data came from.
 */
function normalizeDb(parsed: Partial<DB>): DB {
  const db: DB = {
    users: Array.isArray(parsed.users) && parsed.users.length > 0 ? parsed.users : DEFAULT_USERS,
    patients: Array.isArray(parsed.patients) ? parsed.patients : [],
    visits: Array.isArray(parsed.visits) ? parsed.visits : [],
    notes: Array.isArray(parsed.notes) ? parsed.notes : [],
    bookings: Array.isArray(parsed.bookings) ? parsed.bookings : [],
    blocked: Array.isArray(parsed.blocked) ? parsed.blocked : [],
    settings: parsed.settings ?? defaultSettings(),
    session: { userId: null },
  };
  if (!db.settings.branches || db.settings.branches.length === 0) {
    db.settings.branches = [{ ...DEFAULT_BRANCH, hours: { ...DEFAULT_HOURS } }];
  }
  db.settings.branches = db.settings.branches.map((b) => ({
    ...b,
    hours: b.hours ?? { ...DEFAULT_HOURS },
    emailId: b.emailId ?? "",
  }));
  if (!db.settings.whatsappNumber) db.settings.whatsappNumber = CLINIC.whatsapp;
  if (typeof db.settings.globalEmail !== "string" || db.settings.globalEmail === "")
    db.settings.globalEmail = "SthairyaPhysiocare@gmail.com";
  if (typeof db.settings.prescriptionUrl !== "string")
    db.settings.prescriptionUrl = "sthairyaphysiocare.pages.dev";
  if (typeof db.settings.prescriptionUrlEnabled !== "boolean")
    db.settings.prescriptionUrlEnabled = true;
  if (typeof db.settings.globalUrl !== "string") db.settings.globalUrl = "";
  if (typeof db.settings.redirectUrl1 !== "string") db.settings.redirectUrl1 = "";
  if (typeof db.settings.redirectUrl2 !== "string") db.settings.redirectUrl2 = "";
  if (!db.settings.socials) db.settings.socials = DEFAULT_SOCIALS();
  for (const k of ["youtube", "instagram", "facebook", "blog"] as const) {
    const v = db.settings.socials[k];
    if (!v || typeof v.url !== "string" || typeof v.enabled !== "boolean") {
      db.settings.socials[k] = { url: v?.url ?? "", enabled: v?.enabled === true };
    }
  }
  if (!db.settings.stats) db.settings.stats = { ...DEFAULT_STATS };
  if (!db.settings.specialities)
    db.settings.specialities = DEFAULT_SPECIALITIES.map((s) => ({ ...s }));
  if (typeof db.settings.cliniciansEnabled !== "boolean") db.settings.cliniciansEnabled = false;
  if (!db.settings.clinicians) db.settings.clinicians = [];
  db.users = db.users.map((u) => ({ ...u, emailId: u.emailId ?? "" }));
  const defId = db.settings.branches[0].id;
  db.patients = db.patients.map((p) => ({
    ...p,
    br: p.br || defId,
    status: p.status || "active",
    emN: p.emN ?? "",
    emP: p.emP ?? "",
  }));
  return db;
}

/**
 * Legacy localStorage blob — read ONLY as a one-time migration source when
 * the cloud database is empty. localStorage is otherwise fully bypassed.
 */
function readLegacyLocalStorage(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

// SSR-safe: always start from defaults so server + first client render agree.
// Real state (loaded from Turso, or migrated from legacy localStorage on first
// visit) is swapped in after mount via ensureHydrated().
const SERVER_SNAPSHOT: DB = defaultDb();
let state: DB = SERVER_SNAPSHOT;
let hydrated = false;
let hydrating = false;
/**
 * Set when a cloud hydrate FAILED and the in-memory state is therefore NOT a
 * true reflection of the database — it is either the emergency legacy
 * localStorage view or, worse, `defaultDb()` sample data.
 *
 * While this is true, nothing may be written to the cloud. syncState is
 * destructive by design: it upserts the records it is given and then DELETES
 * any row whose id is absent from the payload. So syncing sample data over a
 * live database does not merely add junk, it erases every real patient,
 * visit, note and booking. That is exactly what happened twice in production:
 * the database was briefly unreachable, the app fell back to sample data,
 * marked itself hydrated anyway, and the first save wiped the clinic's
 * records.
 *
 * The rule this enforces: if we never successfully READ the database, we are
 * never allowed to WRITE to it.
 */
let hydrateFailed = false;
/**
 * The error message from the last failed hydrate, or null if the database was
 * read successfully. Exposed via getHydrateError() so the UI can show the
 * clinic a real error instead of an empty-looking but "working" app.
 */
let hydrateError: string | null = null;

/** Non-null when the database could not be read. See `hydrateError`. */
export function getHydrateError(): string | null {
  return hydrateError;
}
const listeners = new Set<() => void>();

// Debounced persistence to Turso via server function. We keep the local
// in-memory state authoritative for the UI and reconcile to the cloud in
// the background. Failures surface as toasts via a subscribable status.
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSave = false;
let saveInFlight = false;
let lastSyncedPayload: string | null = null;
export type SyncStatus = "idle" | "syncing" | "error" | "offline";
let syncStatus: SyncStatus = "idle";
const statusListeners = new Set<(s: SyncStatus) => void>();
function setSyncStatus(s: SyncStatus) {
  if (syncStatus === s) return;
  syncStatus = s;
  statusListeners.forEach((l) => l(s));
}
export function subscribeSyncStatus(l: (s: SyncStatus) => void) {
  statusListeners.add(l);
  l(syncStatus);
  return () => statusListeners.delete(l);
}
export function getSyncStatus() {
  return syncStatus;
}

async function flushToCloud() {
  // HARD STOP 1: never write before a successful read has completed.
  //
  // `state` is initialised to defaultDb() at module load — sample data — so
  // that SSR and the first client render agree. Real data only arrives later,
  // asynchronously, via ensureHydrated(). Anything that mutated state inside
  // that window (a login attempt, a settings read, any UI interaction) called
  // persist() -> schedulePersist() -> here on a 400ms timer, and pushed that
  // sample data to Turso, where the prune step deleted every real record.
  //
  // This is why the failure looked machine-specific and intermittent: it
  // depends entirely on whether something touched state before the database
  // finished loading, which varies with connection speed and what the user
  // clicked first. The earlier `hydrateFailed` guard did not catch it because
  // hydration had not failed — it simply had not finished yet.
  //
  // Rule: no successful read, no write. Ever.
  if (!hydrated) {
    console.warn("[store] refusing to sync: initial database load has not completed yet.");
    return;
  }
  // HARD STOP 2: never write when the last hydrate failed. See `hydrateFailed`.
  // Placed here rather than at the call sites deliberately — this is the one
  // function that writes to the cloud, so guarding it covers every current
  // and future caller, including the automatic retry below.
  if (hydrateFailed) {
    console.warn(
      "[store] refusing to sync: the database could not be read, so in-memory state is not authoritative. Writing now would delete live records.",
    );
    setSyncStatus("offline");
    return;
  }
  if (saveInFlight) {
    pendingSave = true;
    return;
  }
  saveInFlight = true;
  try {
    const { syncState } = await import("./db.functions");
    // Session state is per-browser (sessionStorage) — never persist to cloud.
    const toSave = { ...state, session: { userId: null } };
    const payload = JSON.stringify(toSave);
    // Dirty check: if the serialized state is byte-identical to the last
    // successful sync, skip the network write entirely.
    if (payload === lastSyncedPayload) {
      setSyncStatus("idle");
      return;
    }
    setSyncStatus("syncing");
    const res = await syncState({ data: { data: payload } });
    const resFailures = Array.isArray(res?.failures) ? res.failures : ["sync:malformed-response"];
    if (resFailures.length > 0) {
      console.error("[store] some records failed to sync:", resFailures);
      setSyncStatus("error");
    } else {
      lastSyncedPayload = payload;
      setSyncStatus("idle");
    }
  } catch (err) {
    console.error("[store] cloud save failed", err);
    setSyncStatus("error");
    // A retry fires automatically on the next mutation; state stays in memory.
  } finally {
    saveInFlight = false;
    if (pendingSave) {
      pendingSave = false;
      queueMicrotask(flushToCloud);
    }
  }
}

function schedulePersist() {
  if (typeof window === "undefined") return;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(flushToCloud, 400);
}

async function ensureHydrated() {
  if (hydrated || hydrating || typeof window === "undefined") return;
  hydrating = true;
  try {
    const { loadSnapshot, migrateLocalStorageToTurso } = await import("./db.functions");
    let snap = await loadSnapshot();

    if (snap.empty) {
      // Cloud database is empty. If a legacy localStorage blob exists,
      // migrate it record-by-record on the server, then reload.
      const legacy = readLegacyLocalStorage();
      if (legacy) {
        try {
          const report = await migrateLocalStorageToTurso({ data: { data: legacy } });
          console.info("[store] localStorage migration report:", report);
          snap = await loadSnapshot();
        } catch (err) {
          console.error("[store] localStorage migration failed:", err);
        }
      }
    }

    if (snap.empty) {
      // The read SUCCEEDED and the database is genuinely empty (a true fresh
      // install). Seed defaults in memory so the app is usable, but do NOT
      // automatically push them. An unattended write of seed data is the
      // exact shape of the incident that destroyed live data four times, and
      // saving a one-time setup step is not worth carrying that risk. The
      // seed persists on the first real user action instead.
      hydrateFailed = false;
      hydrateError = null;
      state = defaultDb();
    } else {
      // Real data read back successfully — this state is authoritative and
      // may be written to the cloud.
      hydrateFailed = false;
      hydrateError = null;
      state = normalizeDb({
        users: snap.users,
        patients: snap.patients,
        visits: snap.visits,
        notes: snap.notes,
        bookings: snap.bookings,
        blocked: snap.blocked,
        settings: snap.settings ?? undefined,
      });
    }
  } catch (err) {
    console.error("[store] cloud hydrate failed — database unreachable", err);
    setSyncStatus("offline");
    hydrateFailed = true;
    // The database could not be read, so we have NO authoritative data.
    //
    // Everything here used to fall back to defaultDb() sample data, or to a
    // stale localStorage blob. Both were catastrophic: the app looked normal,
    // the clinic signed in, and the first save pushed that fabricated state
    // over the real database, deleting every record absent from it. That
    // destroyed the clinic's live data four separate times.
    //
    // The rule now: if we cannot read the database, we show NOTHING and say
    // so. An empty state with a visible error is recoverable; sample data
    // that silently replaces real records is not.
    state = emptyDb();
    hydrateError = err instanceof Error ? err.message : String(err);
  } finally {
    // Restore per-browser session from sessionStorage (never persisted to cloud).
    const sess = sessLoad();
    if (sess && state.users.some((u) => u.id === sess.userId)) {
      state = { ...state, session: { userId: sess.userId } };
    } else {
      state = { ...state, session: { userId: null } };
      sessClear();
    }
    hydrated = true;
    hydrating = false;
    listeners.forEach((l) => l());
  }
}

function persist() {
  listeners.forEach((l) => l());
  schedulePersist();
}

function subscribe(l: () => void) {
  listeners.add(l);
  if (typeof window !== "undefined" && !hydrated && !hydrating) {
    queueMicrotask(ensureHydrated);
  }
  return () => listeners.delete(l);
}

export function useStore<T>(selector: (s: DB) => T): T {
  const snap = useSyncExternalStore(
    subscribe,
    () => state,
    () => SERVER_SNAPSHOT,
  );
  return selector(snap);
}

export type LoginResult =
  | { ok: true; user: User }
  | {
      ok: false;
      reason: "locked" | "account-locked" | "bad-credentials" | "network";
      remainingMs?: number;
      failsLeft?: number;
    };

export const store = {
  get: () => state,
  async login(username: string, password: string): Promise<LoginResult> {
    // Ensure current state is in cloud so verifyLogin can read it.
    if (!hydrated) await ensureHydrated();

    // If the database could not be read, refuse to sign anyone in.
    //
    // Previously the app fell back to sample accounts here, which produced a
    // working-looking session backed by fabricated data — and the first save
    // then wrote that over the real database. Failing the login outright
    // keeps a database outage visible as a database outage.
    if (hydrateFailed) {
      return { ok: false, reason: "bad-credentials" };
    }

    // The Admin account is NEVER locked out — neither by the server-side
    // account lock nor by the client-side offline rate limit. Brute force
    // against admin is mitigated server-side with a progressive delay.
    const knownLocal = state.users.find((x) => x.email.toLowerCase() === username.toLowerCase());
    const isAdminAccount = knownLocal?.role === "admin";

    if (!isAdminAccount) {
      const rem = lockoutRemainingMs(username);
      if (rem > 0) return { ok: false, reason: "locked", remainingMs: rem };
    }

    let serverOk: string | null = null;
    let serverReachable = true;
    let serverFailsLeft: number | undefined;
    try {
      const { verifyLogin } = await import("./db.functions");
      const res = await verifyLogin({ data: { username, password } });
      if (res.ok) serverOk = res.userId;
      else if (res.reason === "no-state")
        serverReachable = false; // fall through to local
      else if (res.reason === "account-locked") {
        return { ok: false, reason: "account-locked" };
      } else if (res.reason === "bad-password" && "failsLeft" in res) {
        serverFailsLeft = res.failsLeft;
      }
    } catch (err) {
      console.warn("[store] verifyLogin unreachable, using local fallback", err);
      serverReachable = false;
    }

    let matched: User | null = null;
    if (serverOk) {
      matched = state.users.find((u) => u.id === serverOk) ?? null;
    } else if (!serverReachable) {
      // Offline / no cloud state yet — allow legacy plaintext local match.
      //
      // But NOT when the hydrate failed: in that case `state.users` is the
      // built-in sample seed, not the real staff list. Signing in against
      // sample accounts is what let a database outage turn into data loss —
      // the user got a working-looking session backed by sample data, and
      // the first save wiped the real records. Refuse instead, so the outage
      // stays visible as an outage.
      matched = hydrateFailed
        ? null
        : (state.users.find(
            (x) => x.email.toLowerCase() === username.toLowerCase() && x.password === password,
          ) ?? null);
    }

    if (!matched) {
      if (serverReachable) {
        // Server is authoritative for attempt counting; don't double-count.
        return { ok: false, reason: "bad-credentials", failsLeft: serverFailsLeft };
      }
      if (isAdminAccount) return { ok: false, reason: "bad-credentials" };
      const info = registerLoginFailure(username);
      if (info.locked) return { ok: false, reason: "locked", remainingMs: info.remainingMs };
      return { ok: false, reason: "bad-credentials", failsLeft: info.failsLeft };
    }

    clearLoginFailures(username);
    sessSave(matched.id);
    state = { ...state, session: { userId: matched.id } };
    persist();
    return { ok: true, user: matched };
  },
  /** Clear a staff account lockout (admin action, or after OTP password reset). */
  async unlockUser(id: string): Promise<boolean> {
    try {
      const { unlockUser } = await import("./db.functions");
      await unlockUser({ data: { userId: id } });
      state = {
        ...state,
        users: state.users.map((u) => (u.id === id ? { ...u, locked: false } : u)),
      };
      persist();
      return true;
    } catch (err) {
      console.error("[store] unlockUser failed", err);
      return false;
    }
  },
  touchSession() {
    sessTouch();
  },
  logout() {
    // Actively clear all auth-related browser storage and in-memory session
    // state (route guards then prevent any dashboard render).
    sessClear();
    void import("./session").then(({ purgeSession }) => purgeSession()).catch(() => undefined);
    state = { ...state, session: { userId: null } };
    persist();
  },
  currentUser(): User | null {
    return state.users.find((u) => u.id === state.session.userId) ?? null;
  },
  changePassword(userId: string, newPw: string) {
    state = {
      ...state,
      users: state.users.map((u) => (u.id === userId ? { ...u, password: newPw } : u)),
    };
    persist();
  },
  addUser(u: Omit<User, "id">) {
    const nu: User = { ...u, id: `u${Date.now()}` };
    state = { ...state, users: [...state.users, nu] };
    persist();
    return nu;
  },
  updateUser(id: string, patch: Partial<Pick<User, "name" | "email" | "role" | "emailId">>) {
    state = { ...state, users: state.users.map((u) => (u.id === id ? { ...u, ...patch } : u)) };
    persist();
  },
  removeUser(id: string) {
    state = { ...state, users: state.users.filter((u) => u.id !== id) };
    persist();
  },
  resetPassword(id: string, pw: string) {
    this.changePassword(id, pw);
  },
  nextPid(): string {
    const max = state.patients.reduce((acc, p) => {
      const n = parseInt(p.pid.replace("STP", ""), 10);
      return n > acc ? n : acc;
    }, 0);
    return `STP${String(max + 1).padStart(6, "0")}`;
  },
  addPatient(p: Omit<Patient, "id" | "pid" | "sn" | "ts">): Patient {
    const np: Patient = {
      ...p,
      id: `p${Date.now()}`,
      pid: this.nextPid(),
      sn: p.n.toLowerCase(),
      status: p.status || "active",
      ts: Date.now(),
    };
    state = { ...state, patients: [...state.patients, np] };
    persist();
    return np;
  },
  updatePatient(id: string, patch: Partial<Patient>) {
    state = {
      ...state,
      patients: state.patients.map((p) =>
        p.id === id ? { ...p, ...patch, sn: (patch.n ?? p.n).toLowerCase() } : p,
      ),
    };
    persist();
  },
  deletePatient(id: string) {
    state = {
      ...state,
      patients: state.patients.filter((p) => p.id !== id),
      visits: state.visits.filter((v) => v.patientId !== id),
      notes: state.notes.filter((n) => n.patientId !== id),
    };
    persist();
  },
  addVisit(v: Omit<Visit, "id" | "vN">): Visit {
    const vN = state.visits.filter((x) => x.patientId === v.patientId).length + 1;
    const nv: Visit = { ...v, id: `v${Date.now()}`, vN };
    state = { ...state, visits: [...state.visits, nv] };
    persist();
    return nv;
  },
  updateVisit(id: string, patch: Partial<Visit>) {
    state = { ...state, visits: state.visits.map((v) => (v.id === id ? { ...v, ...patch } : v)) };
    persist();
  },
  addNote(n: Omit<ClinicalNote, "id">) {
    const nn: ClinicalNote = { ...n, id: `n${Date.now()}` };
    state = { ...state, notes: [...state.notes, nn] };
    persist();
  },
  addBooking(b: Omit<Booking, "id" | "ts" | "status">) {
    const nb: Booking = { ...b, id: `b${Date.now()}`, ts: Date.now(), status: "pending" };
    state = { ...state, bookings: [...state.bookings, nb] };
    persist();
    return nb;
  },
  updateBooking(id: string, patch: Partial<Booking>) {
    state = {
      ...state,
      bookings: state.bookings.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    };
    persist();
  },
  clearClosedBookings() {
    state = { ...state, bookings: state.bookings.filter((b) => b.status !== "closed") };
    persist();
  },
  addBlocked(b: Omit<BlockedSlot, "id">) {
    const nb: BlockedSlot = { ...b, id: `bk${Date.now()}` };
    state = { ...state, blocked: [...state.blocked, nb] };
    persist();
  },
  removeBlocked(id: string) {
    state = { ...state, blocked: state.blocked.filter((b) => b.id !== id) };
    persist();
  },
  setSettings(patch: Partial<AppSettings>) {
    state = { ...state, settings: { ...state.settings, ...patch } };
    persist();
  },
  addBranch(b: Omit<Branch, "id">): Branch {
    const nb: Branch = { ...b, id: `br${Date.now()}`, hours: b.hours ?? { ...DEFAULT_HOURS } };
    state = {
      ...state,
      settings: { ...state.settings, branches: [...state.settings.branches, nb] },
    };
    persist();
    return nb;
  },
  updateBranch(id: string, patch: Partial<Branch>) {
    state = {
      ...state,
      settings: {
        ...state.settings,
        branches: state.settings.branches.map((b) => (b.id === id ? { ...b, ...patch } : b)),
      },
    };
    persist();
  },
  removeBranch(id: string) {
    if (state.settings.branches.length <= 1) return;
    const remaining = state.settings.branches.filter((b) => b.id !== id);
    const fallback = remaining[0].id;
    state = {
      ...state,
      settings: { ...state.settings, branches: remaining },
      patients: state.patients.map((p) => (p.br === id ? { ...p, br: fallback } : p)),
    };
    persist();
  },
  // Specialities
  addSpeciality(s: Omit<SpecialityItem, "id">) {
    const ns: SpecialityItem = { ...s, id: `sp${Date.now()}` };
    state = {
      ...state,
      settings: { ...state.settings, specialities: [...state.settings.specialities, ns] },
    };
    persist();
  },
  updateSpeciality(id: string, patch: Partial<SpecialityItem>) {
    state = {
      ...state,
      settings: {
        ...state.settings,
        specialities: state.settings.specialities.map((s) =>
          s.id === id ? { ...s, ...patch } : s,
        ),
      },
    };
    persist();
  },
  removeSpeciality(id: string) {
    state = {
      ...state,
      settings: {
        ...state.settings,
        specialities: state.settings.specialities.filter((s) => s.id !== id),
      },
    };
    persist();
  },
  // Clinicians
  addClinician(c: Omit<Clinician, "id">) {
    const nc: Clinician = { ...c, id: `cl${Date.now()}` };
    state = {
      ...state,
      settings: { ...state.settings, clinicians: [...state.settings.clinicians, nc] },
    };
    persist();
  },
  updateClinician(id: string, patch: Partial<Clinician>) {
    state = {
      ...state,
      settings: {
        ...state.settings,
        clinicians: state.settings.clinicians.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      },
    };
    persist();
  },
  removeClinician(id: string) {
    state = {
      ...state,
      settings: {
        ...state.settings,
        clinicians: state.settings.clinicians.filter((c) => c.id !== id),
      },
    };
    persist();
  },
};

/**
 * Duration-aware conflict check for a candidate appointment.
 * Returns "taken" when the start time itself sits inside an existing blocked
 * interval, "overlap" when the start is free but the chosen duration runs
 * into a later blocked interval, or null when the whole window is free.
 */
export function slotConflict(
  s: DB,
  date: string,
  time: string,
  dur: number,
  excludeVisitId?: string,
): "taken" | "overlap" | null {
  if (!date || !time) return null;
  const taken = new Set(takenSlotsForDate(s, date, excludeVisitId));
  const [h, m] = time.split(":").map(Number);
  const start = h * 60 + m;
  for (let t = start; t < start + dur; t += 30) {
    const key = `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
    if (taken.has(key)) return t === start ? "taken" : "overlap";
  }
  return null;
}

export function takenSlotsForDate(s: DB, date: string, excludeVisitId?: string): string[] {
  const out = new Set<string>();
  for (const v of s.visits) {
    if (v.id === excludeVisitId) continue; // rescheduling: ignore own slot
    if (v.nxt === date && v.nxtTm) {
      const dur = v.dur ?? 30;
      addRange(out, v.nxtTm, dur);
    }
  }
  for (const b of s.bookings) {
    if (b.status === "scheduled" && b.prefDate === date && b.prefTime)
      addRange(out, b.prefTime, 30);
  }
  for (const bk of s.blocked) {
    if (bk.date === date) addRange(out, bk.time, bk.dur);
  }
  return Array.from(out);
}

function addRange(out: Set<string>, start: string, dur: number) {
  const [h, m] = start.split(":").map(Number);
  let mins = h * 60 + m;
  const end = mins + dur;
  while (mins < end) {
    out.add(
      `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`,
    );
    mins += 30;
  }
}

export type { Role };
