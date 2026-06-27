export type Role = "admin" | "therapist" | "reception";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  password: string;
}

export interface Patient {
  id: string;
  pid: string;
  n: string;
  sn: string;
  dob: string;
  g: "M" | "F" | "O";
  m: string;
  am: string;
  e: string;
  oc: string;
  em: string;
  bg: string;
  h: number;
  w: number;
  cc: string;
  pi: string;
  sx: string;
  med: string;
  al: string;
  cm: number[];
  lf: string;
  fh: string;
  ts: number;
}

export interface Visit {
  id: string;
  patientId: string;
  vN: number;
  dt: string;
  tId: string;
  tN: string;
  pS: number;
  sym: string;
  rom: string;
  str: string;
  tx: string;
  adv: string;
  fi: number;
  nxt: string;
  nxtTm?: string; // HH:MM next review time slot
  dur?: number; // minutes, default 30
}

export interface ClinicalNote {
  id: string;
  patientId: string;
  dt: string;
  tm: string;
  tN: string;
  msg: string;
}

export interface Booking {
  id: string;
  name: string;
  phone: string;
  email: string;
  concern: string;
  preferred: string; // legacy free-text
  prefDate?: string; // ISO yyyy-mm-dd
  prefTime?: string; // HH:MM
  status: "pending" | "contacted" | "scheduled" | "closed";
  ts: number;
}

export interface BlockedSlot {
  id: string;
  date: string;
  time: string;
  dur: number; // minutes
  reason: string;
  by: string;
}

export interface AppSettings {
  publicStatsEnabled: boolean;
}

export interface ClinicalNote {
  id: string;
  patientId: string;
  dt: string;
  tm: string;
  tN: string;
  msg: string;
}

export interface Booking {
  id: string;
  name: string;
  phone: string;
  email: string;
  concern: string;
  preferred: string;
  status: "pending" | "contacted" | "scheduled" | "closed";
  ts: number;
}

export const COMORBIDITIES: Record<number, string> = {
  1: "Diabetes",
  2: "Hypertension",
  3: "Thyroid",
  4: "Cardiac",
  5: "Neurological",
};
