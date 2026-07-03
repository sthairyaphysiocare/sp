import { createFileRoute, Link } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { Users, Activity, CalendarCheck2, Inbox } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { fmtDate, fmtTime12 } from "@/lib/date";
import { openWhatsApp } from "@/lib/utils";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { toast } from "sonner";

export const Route = createFileRoute("/app/")({
  component: Dashboard,
});

function useCount(target: number, duration = 800) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      setN(Math.round(target * (0.5 - Math.cos(Math.PI * p) / 2)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return n;
}

type KPIKey = "patients" | "active" | "today" | "pending";

function KPI({
  icon: Icon,
  label,
  value,
  accent,
  active,
  onClick,
  mobilePanel,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: number;
  accent: string;
  active: boolean;
  onClick: () => void;
  mobilePanel?: ReactNode;
}) {
  const n = useCount(value);
  return (
    <div className={active ? "sm:contents" : ""}>
      <button
        onClick={onClick}
        aria-expanded={active}
        className={`text-left p-5 sm:p-6 rounded-2xl bg-card border hover:soft-shadow transition-all w-full ${active ? "ring-2 ring-brand" : ""}`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              {label}
            </div>
            <div className="text-2xl sm:text-3xl font-bold mt-2">{n.toLocaleString()}</div>
          </div>
          <div
            className={`size-11 sm:size-12 rounded-xl grid place-items-center text-white shrink-0 ${accent}`}
          >
            <Icon className="size-5 sm:size-6" />
          </div>
        </div>
        <div className="mt-3 text-xs text-brand font-medium">
          {active ? "▼ Hide details" : "Tap to view details →"}
        </div>
      </button>
      {active && mobilePanel && (
        <div className="sm:hidden mt-3 animate-in fade-in slide-in-from-top-2 duration-200">
          {mobilePanel}
        </div>
      )}
    </div>
  );
}

function Dashboard() {
  const { user } = useAuth();
  const patients = useStore((s) => s.patients);
  const visits = useStore((s) => s.visits);
  const bookings = useStore((s) => s.bookings);
  const today = new Date().toISOString().slice(0, 10);
  const todaysVisits = visits.filter((v) => v.nxt === today);
  const todaysBookings = bookings.filter((b) => b.status === "scheduled" && b.prefDate === today);
  const activePatients = patients.filter((p) => (p.status || "active") === "active");
  const pendingBookings = bookings.filter((b) => b.status === "pending");

  const isOther = user?.role === "other";

  const [open, setOpen] = useState<KPIKey | null>(null);
  const toggle = (k: KPIKey) => setOpen((c) => (c === k ? null : k));

  function panelFor(k: KPIKey) {
    if (k === "patients")
      return (
        <DataTable
          title="All Patients"
          cols={["PID", "Name", "Phone", "Registered"]}
          rows={patients.map((p) => [p.pid, p.n, p.m, fmtDate(p.ts)])}
          links={patients.map((p) => `/app/patients/${p.id}`)}
        />
      );
    if (k === "active")
      return (
        <DataTable
          title="Active Rehab Patients"
          cols={["PID", "Name", "Complaint", "Latest FI"]}
          rows={activePatients.map((p) => {
            const last = [...visits]
              .filter((v) => v.patientId === p.id)
              .sort((a, b) => a.dt.localeCompare(b.dt))
              .pop();
            return [p.pid, p.n, p.cc, last ? `${last.fi}%` : "—"];
          })}
          links={activePatients.map((p) => `/app/patients/${p.id}`)}
        />
      );
    if (k === "today") {
      type Row = {
        key: string;
        name: string;
        phone: string;
        time: string;
        sub: string;
        link: string;
      };
      const rows: Row[] = [
        ...todaysVisits.map((v) => {
          const p = patients.find((x) => x.id === v.patientId);
          return {
            key: `v-${v.id}`,
            name: p?.n ?? "Unknown",
            phone: p?.m ?? "",
            time: v.nxtTm || "—",
            sub: `Clinical · ${v.tN || "—"}`,
            link: `/app/patients/${v.patientId}`,
          };
        }),
        ...todaysBookings.map((b) => ({
          key: `b-${b.id}`,
          name: b.name,
          phone: b.phone,
          time: b.prefTime || "—",
          sub: "Public Web Booking",
          link: "/app/bookings",
        })),
      ].sort((a, b) => (a.time === "—" ? 1 : b.time === "—" ? -1 : a.time.localeCompare(b.time)));
      return (
        <div className="mt-4 rounded-2xl bg-card border overflow-hidden">
          <div className="px-5 py-4 border-b font-semibold">Today's Scheduled Visits</div>
          {rows.length === 0 && (
            <p className="p-6 text-sm text-muted-foreground">Nothing scheduled for today.</p>
          )}
          <div className="divide-y">
            {rows.map((r) => (
              <div key={r.key} className="px-5 py-3 flex items-center gap-3">
                <Link to={r.link} className="min-w-0 flex-1 hover:underline underline-offset-2">
                  <div className="text-sm font-medium truncate">{r.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {r.time !== "—" ? fmtTime12(r.time) : "Time TBC"} · {r.sub}
                  </div>
                </Link>
                <button
                  type="button"
                  title="Send WhatsApp reminder"
                  aria-label={`Send WhatsApp reminder to ${r.name}`}
                  onClick={() => {
                    const ok = openWhatsApp(
                      r.phone,
                      `Hello ${r.name}, this is a reminder for your scheduled visit today at Sthairya Physiocare. Thank you!`,
                    );
                    if (!ok) toast.error("No valid mobile number on record");
                  }}
                  className="shrink-0 inline-flex items-center gap-1.5 text-xs font-medium px-3 h-8 rounded-full bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 transition-colors"
                >
                  <WhatsAppIcon size={14} /> Send Reminder
                </button>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return (
      <DataTable
        title="Pending Booking Requests"
        cols={["Name", "Phone", "Preferred Date", "Time"]}
        rows={pendingBookings.map((b) => [
          b.name,
          b.phone,
          b.prefDate ? fmtDate(b.prefDate) : b.preferred || "—",
          b.prefTime || "—",
        ])}
        links={pendingBookings.map(() => "/app/bookings")}
      />
    );
  }

  const cards = [
    {
      key: "patients" as KPIKey,
      icon: Users,
      label: "Total Patients",
      value: patients.length,
      accent: "bg-brand",
      visible: true,
    },
    {
      key: "active" as KPIKey,
      icon: Activity,
      label: "Active Rehab",
      value: activePatients.length,
      accent: "bg-emerald-500",
      visible: true,
    },
    {
      key: "today" as KPIKey,
      icon: CalendarCheck2,
      label: "Today's Visits",
      value: todaysVisits.length,
      accent: "bg-orange-500",
      visible: !isOther,
    },
    {
      key: "pending" as KPIKey,
      icon: Inbox,
      label: "Pending Bookings",
      value: pendingBookings.length,
      accent: "bg-violet-500",
      visible: !isOther,
    },
  ].filter((c) => c.visible);

  return (
    <div>
      <Toaster />
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Welcome back, {user?.name.split(" ")[0]}</h1>
        <p className="text-muted-foreground mt-1 capitalize">{user?.role} workspace</p>
      </div>

      <div
        className={`mt-8 grid sm:grid-cols-2 ${cards.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-2"} gap-4`}
      >
        {cards.map((c) => (
          <KPI
            key={c.key}
            icon={c.icon}
            label={c.label}
            value={c.value}
            accent={c.accent}
            active={open === c.key}
            onClick={() => toggle(c.key)}
            mobilePanel={panelFor(c.key)}
          />
        ))}
      </div>

      {/* Desktop bottom panel — full width, never breaks the grid */}
      {open && (
        <div className="hidden sm:block mt-6 p-6 rounded-2xl bg-card border animate-in fade-in slide-in-from-top-2 duration-200">
          {panelFor(open)}
        </div>
      )}

      <div className="mt-8 grid lg:grid-cols-2 gap-4">
        <div className="p-6 rounded-2xl bg-card border">
          <h2 className="font-semibold text-lg">Recent Patients</h2>
          <div className="mt-4 space-y-2">
            {[...patients]
              .slice(-5)
              .reverse()
              .map((p) => (
                <Link
                  key={p.id}
                  to="/app/patients/$id"
                  params={{ id: p.id }}
                  className="flex items-center justify-between px-3 py-3 rounded-lg hover:bg-accent gap-3"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{p.n}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {p.pid} · {p.cc}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground shrink-0">{fmtDate(p.ts)}</div>
                </Link>
              ))}
          </div>
        </div>
        <div className="p-6 rounded-2xl bg-card border">
          <h2 className="font-semibold text-lg">Recent Bookings</h2>
          <div className="mt-4 space-y-2">
            {bookings.length === 0 && (
              <p className="text-sm text-muted-foreground">No bookings yet.</p>
            )}
            {[...bookings]
              .slice(-5)
              .reverse()
              .map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between px-3 py-3 rounded-lg bg-surface gap-3"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{b.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {b.phone} ·{" "}
                      {b.prefDate
                        ? `${fmtDate(b.prefDate)} ${b.prefTime ?? ""}`
                        : b.preferred || "Any time"}
                    </div>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-orange-500/10 text-orange-700 capitalize shrink-0">
                    {b.status}
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DataTable({
  title,
  cols,
  rows,
  links,
}: {
  title: string;
  cols: string[];
  rows: (string | number)[][];
  links?: string[];
}) {
  return (
    <div>
      <h3 className="font-semibold text-lg mb-4">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No records found.</p>
      ) : (
        <div className="-mx-3 sm:mx-0 overflow-x-auto">
          <table className="w-full text-sm min-w-[420px]">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground border-b">
              <tr>
                {cols.map((c) => (
                  <th key={c} className="py-2 px-3 text-left font-semibold whitespace-nowrap">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-accent/40">
                  {r.map((cell, j) => (
                    <td key={j} className="py-2.5 px-3 align-top">
                      {j === 0 && links?.[i] ? (
                        <Link to={links[i]} className="text-brand font-medium hover:underline">
                          {cell}
                        </Link>
                      ) : (
                        cell
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
