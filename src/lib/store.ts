import { useSyncExternalStore } from "react";
import type {
  AppSettings, BlockedSlot, Booking, Branch, ClinicalNote, Clinician,
  Patient, PublicStats, SpecialityItem, User, Visit, Role, BranchHours,
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
  { id: "u2", email: "therapist", name: "Dr. Plinija", role: "therapist", password: "password", emailId: "" },
  { id: "u3", email: "reception", name: "Reception Desk", role: "reception", password: "password", emailId: "" },
];

const DEFAULT_HOURS: BranchHours = {
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
  { id: "sp1", icon: "Bone", title: "Back & Neck Pain", desc: "Targeted relief for spinal and postural dysfunction." },
  { id: "sp2", icon: "Bandage", title: "Post-Operative Rehab", desc: "Structured recovery after TKR, ACL, and shoulder surgery." },
  { id: "sp3", icon: "Dumbbell", title: "Sports Injuries", desc: "Performance-driven rehabilitation for athletes." },
  { id: "sp4", icon: "Stethoscope", title: "Frozen Shoulder", desc: "Manual therapy and progressive ROM restoration." },
  { id: "sp5", icon: "Accessibility", title: "Orthopaedic Conditions", desc: "Arthritis, tendinopathies, fractures, degenerative joints." },
  { id: "sp6", icon: "Brain", title: "Neurological Rehab", desc: "Stroke recovery, Parkinson's, balance training." },
  { id: "sp7", icon: "Footprints", title: "Gait & Posture", desc: "Gait analysis and biomechanical correction." },
  { id: "sp8", icon: "Baby", title: "Paediatric & Geriatric", desc: "Developmental and mobility programs for all ages." },
];

function seedPatients(): Patient[] {
  const base: Omit<Patient, "id" | "pid" | "sn" | "ts">[] = [
    { n: "Ramesh Kamath", dob: "1972-04-12", g: "M", m: "9845012345", am: "", e: "ramesh@example.com", oc: "Teacher", em: "Sushma 9845011111", emN: "Sushma", emP: "9845011111", bg: "B+", h: 172, w: 78, cc: "Low back pain radiating to right leg", pi: "Onset 3 weeks ago after lifting", sx: "Nil", med: "Paracetamol PRN", al: "Nil", cm: [2], lf: "Sedentary", fh: "Father diabetic", br: DEFAULT_BRANCH.id, tId: "u2", status: "active" },
    { n: "Anjali Shenoy", dob: "1995-09-23", g: "F", m: "9742056789", am: "", e: "anjali@example.com", oc: "IT Engineer", em: "Rohit 9742000000", emN: "Rohit", emP: "9742000000", bg: "O+", h: 162, w: 58, cc: "Neck stiffness, headaches", pi: "Desk work, 6 weeks", sx: "Nil", med: "Nil", al: "Dust", cm: [], lf: "Active weekends", fh: "Nil", br: DEFAULT_BRANCH.id, tId: "u2", status: "active" },
    { n: "Vinod Bhat", dob: "1965-01-30", g: "M", m: "9986234567", am: "", e: "vinod@example.com", oc: "Retired", em: "Lata 9986200000", emN: "Lata", emP: "9986200000", bg: "A+", h: 168, w: 82, cc: "Frozen shoulder right side", pi: "Gradual onset 2 months", sx: "Appendectomy 1995", med: "Metformin", al: "Nil", cm: [1, 2], lf: "Walks daily", fh: "Diabetic", br: DEFAULT_BRANCH.id, tId: "u2", status: "active" },
    { n: "Priya Pai", dob: "1988-07-18", g: "F", m: "9663112233", am: "", e: "priya@example.com", oc: "Homemaker", em: "Suresh 9663100000", emN: "Suresh", emP: "9663100000", bg: "AB+", h: 158, w: 65, cc: "Post-op knee rehab (TKR)", pi: "TKR done 3 weeks back", sx: "TKR Right knee", med: "Calcium, D3", al: "Nil", cm: [], lf: "Limited mobility", fh: "Mother arthritic", br: DEFAULT_BRANCH.id, tId: "u2", status: "active" },
    { n: "Karthik Hegde", dob: "2001-03-05", g: "M", m: "9036778899", am: "", e: "karthik@example.com", oc: "Cricketer", em: "Rajesh 9036700000", emN: "Rajesh", emP: "9036700000", bg: "O-", h: 178, w: 74, cc: "Right shoulder impingement", pi: "Sports injury 10 days back", sx: "Nil", med: "Nil", al: "Nil", cm: [], lf: "Athlete", fh: "Nil", br: DEFAULT_BRANCH.id, tId: "u2", status: "completed" },
  ];
  const now = Date.now();
  return base.map((b, i) => ({
    ...b,
    id: `p${i + 1}`,
    pid: `STP${String(i + 1).padStart(6, "0")}`,
    sn: b.n.toLowerCase(),
    ts: now - (5 - i) * 86400000,
  }));
}

function seedVisits(patients: Patient[]): Visit[] {
  const out: Visit[] = [];
  patients.forEach((p, idx) => {
    const count = 3 + (idx % 3);
    for (let i = 0; i < count; i++) {
      const date = new Date(Date.now() - (count - i) * 5 * 86400000);
      out.push({
        id: `${p.id}-v${i + 1}`,
        patientId: p.id,
        vN: i + 1,
        dt: date.toISOString().slice(0, 10),
        tId: "u2",
        tN: "Dr. Plinija",
        pS: Math.max(1, 8 - i * 1.5 + (idx % 2)),
        sym: i === 0 ? "Initial assessment" : "Follow-up",
        rom: i === 0 ? "Flexion limited 30%" : `Flexion improved ${20 + i * 15}%`,
        str: `MMT ${Math.min(5, 3 + i)}/5`,
        tx: "Manual therapy, IFT, therapeutic exercises",
        adv: "HEP: stretching 3x/day, posture correction",
        fi: Math.min(100, 30 + i * 18 + (idx % 3) * 5),
        nxt: new Date(date.getTime() + 5 * 86400000).toISOString().slice(0, 10),
      });
    }
  });
  return out;
}

function defaultSettings(): AppSettings {
  return {
    publicStatsEnabled: false,
    branches: [{ ...DEFAULT_BRANCH, hours: { ...DEFAULT_HOURS }, emailId: "" }],
    whatsappNumber: CLINIC.whatsapp,
    globalEmail: CLINIC.email,
    stats: { ...DEFAULT_STATS },
    specialities: DEFAULT_SPECIALITIES.map((s) => ({ ...s })),
    cliniciansEnabled: false,
    clinicians: [],
  };
}

function defaultDb(): DB {
  const p = seedPatients();
  return {
    users: DEFAULT_USERS,
    patients: p,
    visits: seedVisits(p),
    notes: [],
    bookings: [],
    blocked: [],
    settings: defaultSettings(),
    session: { userId: null },
  };
}

function load(): DB {
  if (typeof window === "undefined") return defaultDb();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DB;
      if (!parsed.blocked) parsed.blocked = [];
      if (!parsed.settings) parsed.settings = defaultSettings();
      if (!parsed.settings.branches || parsed.settings.branches.length === 0) {
        parsed.settings.branches = [{ ...DEFAULT_BRANCH, hours: { ...DEFAULT_HOURS } }];
      }
      parsed.settings.branches = parsed.settings.branches.map((b) => ({ ...b, hours: b.hours ?? { ...DEFAULT_HOURS }, emailId: b.emailId ?? "" }));
      if (!parsed.settings.whatsappNumber) parsed.settings.whatsappNumber = CLINIC.whatsapp;
      if (typeof parsed.settings.globalEmail !== "string") parsed.settings.globalEmail = CLINIC.email;
      if (!parsed.settings.stats) parsed.settings.stats = { ...DEFAULT_STATS };
      if (!parsed.settings.specialities) parsed.settings.specialities = DEFAULT_SPECIALITIES.map((s) => ({ ...s }));
      if (typeof parsed.settings.cliniciansEnabled !== "boolean") parsed.settings.cliniciansEnabled = false;
      if (!parsed.settings.clinicians) parsed.settings.clinicians = [];
      parsed.users = parsed.users.map((u) => ({ ...u, emailId: u.emailId ?? "" }));
      const defId = parsed.settings.branches[0].id;
      parsed.patients = parsed.patients.map((p) => ({
        ...p,
        br: p.br || defId,
        status: p.status || "active",
        emN: p.emN ?? "",
        emP: p.emP ?? "",
      }));
      return parsed;
    }
  } catch {}
  const db = defaultDb();
  localStorage.setItem(KEY, JSON.stringify(db));
  return db;
}

// SSR-safe: always start from defaults so server + first client render agree.
// Real state (loaded from Turso, or migrated from legacy localStorage on first
// visit) is swapped in after mount via ensureHydrated().
const SERVER_SNAPSHOT: DB = defaultDb();
let state: DB = SERVER_SNAPSHOT;
let hydrated = false;
let hydrating = false;
const listeners = new Set<() => void>();

// Debounced persistence to Turso via server function. We keep the local
// in-memory state authoritative for the UI and reconcile to the cloud in
// the background. Failures surface as toasts via a subscribable status.
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSave = false;
let saveInFlight = false;
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
  if (saveInFlight) {
    pendingSave = true;
    return;
  }
  saveInFlight = true;
  setSyncStatus("syncing");
  try {
    const { saveAppState } = await import("./db.functions");
    // Session state is per-browser (sessionStorage) — never persist to cloud.
    const toSave = { ...state, session: { userId: null } };
    await saveAppState({ data: { data: JSON.stringify(toSave) } });
    setSyncStatus("idle");
  } catch (err) {
    console.error("[store] cloud save failed", err);
    setSyncStatus("error");
    // Fall back to localStorage so no data is lost if the cloud is down.
    try {
      if (typeof window !== "undefined") {
        const toSave = { ...state, session: { userId: null } };
        localStorage.setItem(KEY, JSON.stringify(toSave));
      }
    } catch {}
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
    const { loadAppState } = await import("./db.functions");
    const res = await loadAppState();
    if (res.data) {
      try {
        // Route through load() to run the same shape-migration/defaults logic.
        localStorage.setItem(KEY, res.data);
        state = load();
      } catch {
        state = defaultDb();
      }
    } else {
      // Legacy path: use existing localStorage (if any) as the seed, then
      // push it to the cloud so future loads are cloud-first.
      state = load();
      // Fire and forget — don't block hydration on the write.
      queueMicrotask(flushToCloud);
    }
  } catch (err) {
    console.error("[store] cloud hydrate failed, falling back to localStorage", err);
    setSyncStatus("offline");
    state = load();
  } finally {
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
  const snap = useSyncExternalStore(subscribe, () => state, () => SERVER_SNAPSHOT);
  return selector(snap);
}

export const store = {
  get: () => state,
  login(username: string, password: string): User | null {
    const u = state.users.find((x) => x.email.toLowerCase() === username.toLowerCase() && x.password === password);
    if (!u) return null;
    state = { ...state, session: { userId: u.id } };
    persist();
    return u;
  },
  logout() {
    state = { ...state, session: { userId: null } };
    persist();
  },
  currentUser(): User | null {
    return state.users.find((u) => u.id === state.session.userId) ?? null;
  },
  changePassword(userId: string, newPw: string) {
    state = { ...state, users: state.users.map((u) => (u.id === userId ? { ...u, password: newPw } : u)) };
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
      patients: state.patients.map((p) => (p.id === id ? { ...p, ...patch, sn: (patch.n ?? p.n).toLowerCase() } : p)),
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
    state = { ...state, bookings: state.bookings.map((b) => (b.id === id ? { ...b, ...patch } : b)) };
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
    state = { ...state, settings: { ...state.settings, branches: [...state.settings.branches, nb] } };
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
    state = { ...state, settings: { ...state.settings, specialities: [...state.settings.specialities, ns] } };
    persist();
  },
  updateSpeciality(id: string, patch: Partial<SpecialityItem>) {
    state = {
      ...state,
      settings: { ...state.settings, specialities: state.settings.specialities.map((s) => (s.id === id ? { ...s, ...patch } : s)) },
    };
    persist();
  },
  removeSpeciality(id: string) {
    state = { ...state, settings: { ...state.settings, specialities: state.settings.specialities.filter((s) => s.id !== id) } };
    persist();
  },
  // Clinicians
  addClinician(c: Omit<Clinician, "id">) {
    const nc: Clinician = { ...c, id: `cl${Date.now()}` };
    state = { ...state, settings: { ...state.settings, clinicians: [...state.settings.clinicians, nc] } };
    persist();
  },
  updateClinician(id: string, patch: Partial<Clinician>) {
    state = {
      ...state,
      settings: { ...state.settings, clinicians: state.settings.clinicians.map((c) => (c.id === id ? { ...c, ...patch } : c)) },
    };
    persist();
  },
  removeClinician(id: string) {
    state = { ...state, settings: { ...state.settings, clinicians: state.settings.clinicians.filter((c) => c.id !== id) } };
    persist();
  },
};

export function takenSlotsForDate(s: DB, date: string): string[] {
  const out = new Set<string>();
  for (const v of s.visits) {
    if (v.nxt === date && v.nxtTm) {
      const dur = v.dur ?? 30;
      addRange(out, v.nxtTm, dur);
    }
  }
  for (const b of s.bookings) {
    if (b.status === "scheduled" && b.prefDate === date && b.prefTime) addRange(out, b.prefTime, 30);
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
    out.add(`${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`);
    mins += 30;
  }
}

export type { Role };
