// Global date utilities — display format is always DD-MM-YYYY

/**
 * Today's date in the USER'S LOCAL timezone as YYYY-MM-DD.
 * (`new Date().toISOString()` is UTC — in India that reports *yesterday*
 * between midnight and 05:30, which made "Tomorrow" filters include today.)
 */
export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function fmtDate(input?: string | number | Date | null): string {
  if (!input && input !== 0) return "";
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

export function fmtDateTime(input?: string | number | Date | null): string {
  if (!input && input !== 0) return "";
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${fmtDate(d)} ${hh}:${mi}`;
}

// Clinic operating hours -> 30-minute slots
// Mon-Fri: 09:00-13:00, 16:00-20:00
// Sat: 09:00-13:00
// Sun: closed
export function slotsForDate(dateStr: string): string[] {
  if (!dateStr) return [];
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay(); // 0=Sun
  if (day === 0) return [];
  const ranges: Array<[number, number]> = [];
  if (day === 6) ranges.push([9 * 60, 13 * 60]);
  else ranges.push([9 * 60, 13 * 60], [16 * 60, 20 * 60]);
  const out: string[] = [];
  for (const [s, e] of ranges) {
    for (let m = s; m < e; m += 30) {
      out.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
    }
  }
  return out;
}

export function fmtTime12(t: string): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const am = h < 12;
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:${String(m).padStart(2, "0")} ${am ? "AM" : "PM"}`;
}

// ---------------------------------------------------------------------------
// Branch-aware scheduling helpers
// ---------------------------------------------------------------------------
import type { Branch, BranchHours } from "./types";

const DAY_KEYS: Array<keyof BranchHours> = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/** Tolerant parser for hour strings like "9:00 AM – 1:00 PM & 4:00 PM – 8:00 PM". */
export function parseHourRanges(text: string): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  if (!text) return out;
  if (/closed|appointment/i.test(text)) return out;
  const re = /(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?\s*[–—-]\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const toMin = (
      h: string,
      mm: string | undefined,
      ap: string | undefined,
      fallbackAp?: string,
    ) => {
      let hh = Number(h) % 12;
      const apEff = (ap || fallbackAp || "").toUpperCase();
      if (apEff === "PM") hh += 12;
      return hh * 60 + Number(mm || 0);
    };
    const start = toMin(m[1], m[2], m[3], m[6]);
    const end = toMin(m[4], m[5], m[6], m[3]);
    if (end > start) out.push([start, end]);
  }
  return out;
}

/**
 * Slots for a date, honouring the branch's configured hours when parseable;
 * falls back to the standard clinic schedule otherwise. Returns [] on
 * non-working days (closed / by-appointment / blank Sundays).
 */
export function slotsForDateBranch(dateStr: string, branch?: Branch | null): string[] {
  if (!dateStr) return [];
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return [];
  const key = DAY_KEYS[d.getDay()];
  const text = branch?.hours?.[key];
  if (text !== undefined && text !== null && text !== "") {
    const ranges = parseHourRanges(text);
    if (/closed|appointment/i.test(text)) return [];
    if (ranges.length > 0) {
      const out: string[] = [];
      for (const [s, e] of ranges) {
        for (let m = s; m < e; m += 30) {
          out.push(
            `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`,
          );
        }
      }
      return out;
    }
  }
  return slotsForDate(dateStr);
}

/** True when the branch has at least one bookable slot on the date. */
export function isWorkingDay(dateStr: string, branch?: Branch | null): boolean {
  return slotsForDateBranch(dateStr, branch).length > 0;
}

export function addDaysISO(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Next working day for the branch strictly AFTER the given date. */
export function nextWorkingDay(fromDate: string, branch?: Branch | null): string {
  let d = fromDate;
  for (let i = 0; i < 14; i++) {
    d = addDaysISO(d, 1);
    if (isWorkingDay(d, branch)) return d;
  }
  return addDaysISO(fromDate, 1);
}

/** Remove slots that are already in the past for today (with a small buffer). */
export function filterPastSlots(dateStr: string, slots: string[], bufferMin = 15): string[] {
  if (dateStr !== todayISO()) return slots;
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes() + bufferMin;
  return slots.filter((t) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m >= nowMin;
  });
}
