export type Role = "admin" | "therapist" | "reception" | "other";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  password: string;
}

export interface BranchHours {
  mon: string;
  tue: string;
  wed: string;
  thu: string;
  fri: string;
  sat: string;
  sun: string;
}

export interface Branch {
  id: string;
  name: string;
  address: string;
  mapUrl: string;
  phone: string;
  license: string;
  enabled: boolean;
  hours?: BranchHours;
}

export type PatientStatus = "active" | "inactive" | "completed";

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
  em: string; // legacy combined emergency
  emN?: string; // emergency contact name
  emP?: string; // emergency contact phone
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
  br?: string; // assigned branch id
  tId?: string; // assigned therapist id
  status?: PatientStatus;
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
  nxtTm?: string;
  dur?: number;
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
  prefDate?: string;
  prefTime?: string;
  br?: string;
  status: "pending" | "contacted" | "scheduled" | "closed";
  ts: number;
}

export interface BlockedSlot {
  id: string;
  date: string;
  time: string;
  dur: number;
  reason: string;
  by: string;
}

export interface PublicStats {
  patients: string;
  years: string;
  recovery: string;
  programs: string;
}

export interface SpecialityItem {
  id: string;
  icon: string; // key into ICON_MAP
  title: string;
  desc: string;
}

export interface Clinician {
  id: string;
  name: string;
  photo: string;
  qualification: string;
  experience: string;
  speciality: string;
}

export interface AppSettings {
  publicStatsEnabled: boolean;
  branches: Branch[];
  whatsappNumber: string;
  stats: PublicStats;
  specialities: SpecialityItem[];
  cliniciansEnabled: boolean;
  clinicians: Clinician[];
}

export const COMORBIDITIES: Record<number, string> = {
  1: "Diabetes",
  2: "Hypertension",
  3: "Thyroid",
  4: "Cardiac",
  5: "Neurological",
};
