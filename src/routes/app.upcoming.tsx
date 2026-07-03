import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { addDaysISO, fmtDate, fmtTime12, todayISO } from "@/lib/date";
import { cn, openWhatsApp } from "@/lib/utils";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { CalendarClock, Stethoscope, Globe } from "lucide-react";

export const Route = createFileRoute("/app/upcoming")({
  component: UpcomingVisits,
});

type Scope = { id: string; label: string; days: number };
const SCOPES: Scope[] = [
  { id: "tomorrow", label: "Tomorrow", days: 1 },
  { id: "3d", label: "Next 3 Days", days: 3 },
  { id: "7d", label: "Next 7 Days", days: 7 },
  { id: "30d", label: "Next 30 Days", days: 30 },
];

interface Row {
  key: string;
  name: string;
  phone: string;
  source: "clinical" | "booking";
  date: string;
  time: string;
  reason: string;
  link: string;
}

function UpcomingVisits() {
  const patients = useStore((s) => s.patients);
  const visits = useStore((s) => s.visits);
  const bookings = useStore((s) => s.bookings);
  const [scope, setScope] = useState<Scope>(SCOPES[2]);

  const today = todayISO();
  // "Tomorrow" is exactly tomorrow; other scopes span [tomorrow .. today+N].
  const from = addDaysISO(today, 1);
  const to = scope.days === 1 ? from : addDaysISO(today, scope.days);
  const inRange = (d: string | undefined | null) => !!d && d >= from && d <= to;

  // Unified query across the clinical visits (Next Review Date) and the
  // public bookings in the 'scheduled' state, merged and sorted by date+time.
  const rows: Row[] = [
    ...visits
      .filter((v) => inRange(v.nxt))
      .map((v): Row => {
        const p = patients.find((x) => x.id === v.patientId);
        return {
          key: `v-${v.id}`,
          name: p?.n ?? "Unknown",
          phone: p?.m ?? "",
          source: "clinical",
          date: v.nxt,
          time: v.nxtTm || "",
          reason: p?.cc || v.sym || "—",
          link: `/app/patients/${v.patientId}`,
        };
      }),
    ...bookings
      .filter((b) => b.status === "scheduled" && inRange(b.prefDate))
      .map((b): Row => ({
        key: `b-${b.id}`,
        name: b.name,
        phone: b.phone,
        source: "booking",
        date: b.prefDate as string,
        time: b.prefTime || "",
        reason: b.concern || "—",
        link: "/app/bookings",
      })),
  ].sort((a, b) => (a.date + (a.time || "99:99")).localeCompare(b.date + (b.time || "99:99")));

  function remind(r: Row) {
    const when = `${fmtDate(r.date)}${r.time ? ` at ${fmtTime12(r.time)}` : ""}`;
    const message =
      r.source === "clinical"
        ? `Hello ${r.name}, this is an advance reminder for your upcoming physiotherapy session at Sthairya Physiocare scheduled on ${when}. See you soon!`
        : `Hello ${r.name}, regarding your recent appointment request submitted to Sthairya Physiocare, we have successfully scheduled your slot for ${when}. Please contact us for any changes.`;
    if (!openWhatsApp(r.phone, message)) toast.error("No valid mobile number on record");
  }

  return (
    <div>
      <Toaster />
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CalendarClock className="size-6 text-brand" /> Upcoming Visits
        </h1>
      </div>
      <p className="text-sm text-muted-foreground mt-1">
        Clinical review appointments and scheduled public booking requests, merged chronologically.
      </p>

      <div className="mt-4 inline-flex rounded-xl border bg-card p-1 gap-1 flex-wrap">
        {SCOPES.map((sc) => (
          <button
            key={sc.id}
            type="button"
            onClick={() => setScope(sc)}
            className={cn(
              "px-3 h-8 rounded-lg text-sm font-medium transition-colors",
              scope.id === sc.id
                ? "bg-accent text-brand ring-1 ring-brand/40 soft-shadow"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/40",
            )}
          >
            {sc.label}
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-2xl bg-card border overflow-hidden">
        {rows.length === 0 && (
          <p className="p-8 text-sm text-muted-foreground text-center">
            No upcoming visits in this range.
          </p>
        )}
        <div className="divide-y">
          {rows.map((r) => (
            <div key={r.key} className="px-5 py-3 flex items-center gap-3 flex-wrap sm:flex-nowrap">
              <Link to={r.link} className="min-w-0 flex-1 hover:underline underline-offset-2">
                <div className="text-sm font-medium truncate">{r.name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {r.phone || "No number"} · {r.reason}
                </div>
              </Link>
              <div className="text-right shrink-0">
                <div className="text-sm font-medium whitespace-nowrap">
                  {fmtDate(r.date)}
                  {r.time ? ` · ${fmtTime12(r.time)}` : ""}
                </div>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium",
                    r.source === "clinical"
                      ? "bg-brand/10 text-brand"
                      : "bg-violet-500/10 text-violet-700",
                  )}
                >
                  {r.source === "clinical" ? (
                    <>
                      <Stethoscope className="size-3" /> Clinical Appointment
                    </>
                  ) : (
                    <>
                      <Globe className="size-3" /> Public Web Booking
                    </>
                  )}
                </span>
              </div>
              <button
                type="button"
                onClick={() => remind(r)}
                title="Send WhatsApp reminder"
                aria-label={`Send WhatsApp reminder to ${r.name}`}
                className="shrink-0 inline-flex items-center gap-1.5 text-xs font-medium px-3 h-8 rounded-full bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 transition-colors"
              >
                <WhatsAppIcon size={14} /> Send Reminder
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
