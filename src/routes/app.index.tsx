import { createFileRoute, Link } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { useEffect, useState } from "react";
import { Users, Activity, CalendarCheck2, Inbox } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";

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

function KPI({ icon: Icon, label, value, accent }: { icon: any; label: string; value: number; accent: string }) {
  const n = useCount(value);
  return (
    <div className="p-6 rounded-2xl bg-card border hover:soft-shadow transition-all">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
          <div className="text-3xl font-bold mt-2">{n.toLocaleString()}</div>
        </div>
        <div className={`size-12 rounded-xl grid place-items-center text-white ${accent}`}>
          <Icon className="size-6" />
        </div>
      </div>
    </div>
  );
}

function Dashboard() {
  const { user } = useAuth();
  const patients = useStore((s) => s.patients);
  const visits = useStore((s) => s.visits);
  const bookings = useStore((s) => s.bookings);
  const today = new Date().toISOString().slice(0, 10);
  const todays = visits.filter((v) => v.nxt === today).length;
  const active = new Set(visits.filter((v) => v.fi < 90).map((v) => v.patientId)).size;
  const pending = bookings.filter((b) => b.status === "pending").length;

  return (
    <div>
      <Toaster />
      <div>
        <h1 className="text-3xl font-bold">Welcome back, {user?.name.split(" ")[0]}</h1>
        <p className="text-muted-foreground mt-1 capitalize">{user?.role} workspace</p>
      </div>

      <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI icon={Users} label="Total Patients" value={patients.length} accent="bg-brand" />
        <KPI icon={Activity} label="Active Rehab" value={active} accent="bg-emerald-500" />
        <KPI icon={CalendarCheck2} label="Today's Visits" value={todays} accent="bg-orange-500" />
        <KPI icon={Inbox} label="Pending Bookings" value={pending} accent="bg-violet-500" />
      </div>

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
                <div className="text-xs text-muted-foreground">{new Date(p.ts).toLocaleDateString()}</div>
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
                  <div className="text-xs text-muted-foreground">{b.phone} · {b.preferred || "Any time"}</div>
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
