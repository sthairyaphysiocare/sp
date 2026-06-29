import { createFileRoute, Link } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { useEffect, useState } from "react";
import { Users, Activity, CalendarCheck2, Inbox } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { fmtDate } from "@/lib/date";

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
  icon: Icon, label, value, accent, active, onClick,
}: { icon: any; label: string; value: number; accent: string; active: boolean; onClick: () => void }) {
  const n = useCount(value);
  return (
    <button
      onClick={onClick}
      className={`text-left p-6 rounded-2xl bg-card border hover:soft-shadow transition-all w-full ${active ? "ring-2 ring-brand" : ""}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
          <div className="text-3xl font-bold mt-2">{n.toLocaleString()}</div>
        </div>
        <div className={`size-12 rounded-xl grid place-items-center text-white ${accent}`}>
          <Icon className="size-6" />
        </div>
      </div>
      <div className="mt-3 text-xs text-brand font-medium">
        {active ? "▼ Hide details" : "Click to view details →"}
      </div>
    </button>
  );
}

function Dashboard() {
  const { user } = useAuth();
  const patients = useStore((s) => s.patients);
  const visits = useStore((s) => s.visits);
  const bookings = useStore((s) => s.bookings);
  const today = new Date().toISOString().slice(0, 10);
  const todaysVisits = visits.filter((v) => v.nxt === today);
  const activePatients = patients.filter((p) => (p.status || "active") === "active");
  const pendingBookings = bookings.filter((b) => b.status === "pending");

  const [open, setOpen] = useState<KPIKey | null>(null);
  const toggle = (k: KPIKey) => setOpen((c) => (c === k ? null : k));

  return (
    <div>
      <Toaster />
      <div>
        <h1 className="text-3xl font-bold">Welcome back, {user?.name.split(" ")[0]}</h1>
        <p className="text-muted-foreground mt-1 capitalize">{user?.role} workspace</p>
      </div>

      <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI icon={Users} label="Total Patients" value={patients.length} accent="bg-brand" active={open === "patients"} onClick={() => toggle("patients")} />
        <KPI icon={Activity} label="Active Rehab" value={activePatients.length} accent="bg-emerald-500" active={open === "active"} onClick={() => toggle("active")} />
        <KPI icon={CalendarCheck2} label="Today's Visits" value={todaysVisits.length} accent="bg-orange-500" active={open === "today"} onClick={() => toggle("today")} />
        <KPI icon={Inbox} label="Pending Bookings" value={pendingBookings.length} accent="bg-violet-500" active={open === "pending"} onClick={() => toggle("pending")} />
      </div>

      {open && (
        <div className="mt-6 p-6 rounded-2xl bg-card border">
          {open === "patients" && (
            <DataTable
              title="All Patients"
              cols={["PID", "Name", "Phone", "Registered"]}
              rows={patients.map((p) => [p.pid, p.n, p.m, fmtDate(p.ts)])}
              links={patients.map((p) => `/app/patients/${p.id}`)}
            />
          )}
          {open === "active" && (
            <DataTable
              title="Active Rehab Patients"
              cols={["PID", "Name", "Complaint", "Latest FI"]}
              rows={activePatients.map((p) => {
                const last = [...visits].filter((v) => v.patientId === p.id).sort((a, b) => a.dt.localeCompare(b.dt)).pop();
                return [p.pid, p.n, p.cc, last ? `${last.fi}%` : "—"];
              })}
              links={activePatients.map((p) => `/app/patients/${p.id}`)}
            />
          )}
          {open === "today" && (
            <DataTable
              title="Today's Scheduled Visits"
              cols={["Date", "Time", "Patient", "Therapist"]}
              rows={todaysVisits.map((v) => {
                const p = patients.find((x) => x.id === v.patientId);
                return [fmtDate(v.nxt), v.nxtTm || "—", p?.n ?? "Unknown", v.tN];
              })}
              links={todaysVisits.map((v) => `/app/patients/${v.patientId}`)}
            />
          )}
          {open === "pending" && (
            <DataTable
              title="Pending Booking Requests"
              cols={["Name", "Phone", "Preferred Date", "Time"]}
              rows={pendingBookings.map((b) => [b.name, b.phone, b.prefDate ? fmtDate(b.prefDate) : (b.preferred || "—"), b.prefTime || "—"])}
              links={pendingBookings.map(() => "/app/bookings")}
            />
          )}
        </div>
      )}

      <div className="mt-8 grid lg:grid-cols-2 gap-4">
        <div className="p-6 rounded-2xl bg-card border">
          <h2 className="font-semibold text-lg">Recent Patients</h2>
          <div className="mt-4 space-y-2">
            {[...patients].slice(-5).reverse().map((p) => (
              <Link key={p.id} to="/app/patients/$id" params={{ id: p.id }} className="flex items-center justify-between px-3 py-3 rounded-lg hover:bg-accent">
                <div>
                  <div className="font-medium">{p.n}</div>
                  <div className="text-xs text-muted-foreground">{p.pid} · {p.cc}</div>
                </div>
                <div className="text-xs text-muted-foreground">{fmtDate(p.ts)}</div>
              </Link>
            ))}
          </div>
        </div>
        <div className="p-6 rounded-2xl bg-card border">
          <h2 className="font-semibold text-lg">Recent Bookings</h2>
          <div className="mt-4 space-y-2">
            {bookings.length === 0 && <p className="text-sm text-muted-foreground">No bookings yet.</p>}
            {[...bookings].slice(-5).reverse().map((b) => (
              <div key={b.id} className="flex items-center justify-between px-3 py-3 rounded-lg bg-surface">
                <div>
                  <div className="font-medium">{b.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {b.phone} · {b.prefDate ? `${fmtDate(b.prefDate)} ${b.prefTime ?? ""}` : (b.preferred || "Any time")}
                  </div>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-orange-500/10 text-orange-700 capitalize">{b.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DataTable({ title, cols, rows, links }: { title: string; cols: string[]; rows: (string | number)[][]; links?: string[] }) {
  return (
    <div>
      <h3 className="font-semibold text-lg mb-4">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No records found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground border-b">
              <tr>{cols.map((c) => <th key={c} className="py-2 px-3 text-left font-semibold">{c}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-accent/40">
                  {r.map((cell, j) => (
                    <td key={j} className="py-2.5 px-3">
                      {j === 0 && links?.[i] ? (
                        <Link to={links[i]} className="text-brand hover:underline">{cell}</Link>
                      ) : cell}
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
