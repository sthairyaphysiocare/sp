import { useSyncExternalStore } from "react";
import type { AppSettings, BlockedSlot, Booking, ClinicalNote, Patient, User, Visit, Role } from "./types";

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
  { id: "u1", email: "admin", name: "Dr. Admin", role: "admin", password: "password" },
  { id: "u2", email: "therapist", name: "Dr. Plinija", role: "therapist", password: "password" },
  { id: "u3", email: "reception", name: "Reception Desk", role: "reception", password: "password" },
];

function seedPatients(): Patient[] {
  const base: Omit<Patient, "id" | "pid" | "sn" | "ts">[] = [
    { n: "Ramesh Kamath", dob: "1972-04-12", g: "M", m: "9845012345", am: "", e: "ramesh@example.com", oc: "Teacher", em: "Sushma 9845011111", bg: "B+", h: 172, w: 78, cc: "Low back pain radiating to right leg", pi: "Onset 3 weeks ago after lifting", sx: "Nil", med: "Paracetamol PRN", al: "Nil", cm: [2], lf: "Sedentary", fh: "Father diabetic" },
    { n: "Anjali Shenoy", dob: "1995-09-23", g: "F", m: "9742056789", am: "", e: "anjali@example.com", oc: "IT Engineer", em: "Rohit 9742000000", bg: "O+", h: 162, w: 58, cc: "Neck stiffness, headaches", pi: "Desk work, 6 weeks", sx: "Nil", med: "Nil", al: "Dust", cm: [], lf: "Active weekends", fh: "Nil" },
    { n: "Vinod Bhat", dob: "1965-01-30", g: "M", m: "9986234567", am: "", e: "vinod@example.com", oc: "Retired", em: "Lata 9986200000", bg: "A+", h: 168, w: 82, cc: "Frozen shoulder right side", pi: "Gradual onset 2 months", sx: "Appendectomy 1995", med: "Metformin", al: "Nil", cm: [1, 2], lf: "Walks daily", fh: "Diabetic" },
    { n: "Priya Pai", dob: "1988-07-18", g: "F", m: "9663112233", am: "", e: "priya@example.com", oc: "Homemaker", em: "Suresh 9663100000", bg: "AB+", h: 158, w: 65, cc: "Post-op knee rehab (TKR)", pi: "TKR done 3 weeks back", sx: "TKR Right knee", med: "Calcium, D3", al: "Nil", cm: [], lf: "Limited mobility", fh: "Mother arthritic" },
    { n: "Karthik Hegde", dob: "2001-03-05", g: "M", m: "9036778899", am: "", e: "karthik@example.com", oc: "Cricketer", em: "Rajesh 9036700000", bg: "O-", h: 178, w: 74, cc: "Right shoulder impingement", pi: "Sports injury 10 days back", sx: "Nil", med: "Nil", al: "Nil", cm: [], lf: "Athlete", fh: "Nil" },
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

function defaultDb(): DB {
  const p = seedPatients();
  return {
    users: DEFAULT_USERS,
    patients: p,
    visits: seedVisits(p),
    notes: [],
    bookings: [],
    blocked: [],
    settings: { publicStatsEnabled: false },
    session: { userId: null },
  };
}

function load(): DB {
  if (typeof window === "undefined") return defaultDb();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DB;
      // backfill new fields
      if (!parsed.blocked) parsed.blocked = [];
      if (!parsed.settings) parsed.settings = { publicStatsEnabled: false };
      return parsed;
    }
  } catch {}
  const db = defaultDb();
  localStorage.setItem(KEY, JSON.stringify(db));
  return db;
}

let state: DB = load();
const listeners = new Set<() => void>();

function persist() {
  if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify(state));
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useStore<T>(selector: (s: DB) => T): T {
  const snap = useSyncExternalStore(subscribe, () => state, () => state);
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
  updateUser(id: string, patch: Partial<Pick<User, "name" | "email" | "role">>) {
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
    const np: Patient = { ...p, id: `p${Date.now()}`, pid: this.nextPid(), sn: p.n.toLowerCase(), ts: Date.now() };
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
};

// Compute taken slots for a date — combines visits' next reviews, scheduled bookings, and blocked.
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
