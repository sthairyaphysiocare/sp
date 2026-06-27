// Global date utilities — display format is always DD-MM-YYYY
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
