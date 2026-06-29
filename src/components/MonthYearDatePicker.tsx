import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Props {
  value?: string; // YYYY-MM-DD
  onChange: (v: string) => void;
  min?: string;
  max?: string;
  className?: string;
  id?: string;
  yearsBack?: number;
  yearsForward?: number;
  required?: boolean;
}

/**
 * Date input that pairs the browser-native date field
 * with month and year dropdowns for fast selection (e.g. DOB).
 * Works on all OS/browsers.
 */
export function MonthYearDatePicker({
  value = "",
  onChange,
  min,
  max,
  className,
  id,
  yearsBack = 100,
  yearsForward = 5,
  required,
}: Props) {
  const today = new Date();
  const [y, m, d] = value ? value.split("-") : ["", "", ""];

  const years = useMemo(() => {
    const arr: number[] = [];
    const start = today.getFullYear() + yearsForward;
    const end = today.getFullYear() - yearsBack;
    for (let i = start; i >= end; i--) arr.push(i);
    return arr;
  }, [yearsBack, yearsForward]);

  const months = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December",
  ];

  function update(year: string, month: string, day: string) {
    if (!year || !month || !day) {
      // Allow partial — emit only when complete
      if (year && month && day) onChange(`${year}-${month}-${day}`);
      return;
    }
    const ds = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    onChange(ds);
  }

  const [year, setYear] = useState(y || String(today.getFullYear()));
  const [month, setMonth] = useState(m || String(today.getMonth() + 1).padStart(2, "0"));
  const [day, setDay] = useState(d || String(today.getDate()).padStart(2, "0"));

  function pickYear(yr: string) {
    setYear(yr);
    update(yr, month, day);
  }
  function pickMonth(mo: string) {
    const mm = mo.padStart(2, "0");
    setMonth(mm);
    update(year, mm, day);
  }
  function pickDay(dy: string) {
    const dd = dy.padStart(2, "0");
    setDay(dd);
    update(year, month, dd);
  }

  const daysInMonth = useMemo(() => {
    const yy = parseInt(year, 10);
    const mm = parseInt(month, 10);
    if (!yy || !mm) return 31;
    return new Date(yy, mm, 0).getDate();
  }, [year, month]);

  return (
    <div className={cn("grid grid-cols-3 gap-2", className)}>
      <select
        aria-label="Day"
        className="h-9 px-2 rounded-md border bg-background text-sm"
        value={day}
        onChange={(e) => pickDay(e.target.value)}
        required={required}
      >
        <option value="">Day</option>
        {Array.from({ length: daysInMonth }, (_, i) => String(i + 1).padStart(2, "0")).map((d) => (
          <option key={d} value={d}>{parseInt(d, 10)}</option>
        ))}
      </select>
      <select
        aria-label="Month"
        className="h-9 px-2 rounded-md border bg-background text-sm"
        value={month}
        onChange={(e) => pickMonth(e.target.value)}
        required={required}
      >
        <option value="">Month</option>
        {months.map((mn, i) => (
          <option key={mn} value={String(i + 1).padStart(2, "0")}>{mn}</option>
        ))}
      </select>
      <select
        aria-label="Year"
        className="h-9 px-2 rounded-md border bg-background text-sm"
        value={year}
        onChange={(e) => pickYear(e.target.value)}
        required={required}
      >
        <option value="">Year</option>
        {years.map((yr) => (
          <option key={yr} value={String(yr)}>{yr}</option>
        ))}
      </select>
      {/* Hidden native input kept for form submission compatibility */}
      <Input id={id} type="hidden" value={value} min={min} max={max} readOnly />
    </div>
  );
}
