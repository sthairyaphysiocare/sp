import { createFileRoute, Link } from "@tanstack/react-router";
import { store, useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useState } from "react";
import { Search, Plus } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { IconButton } from "@/components/IconButton";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/app/patients/")({
  component: Patients,
});

const PAGE = 10;

function Patients() {
  const patients = useStore((s) => s.patients);
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const canCreate = hasRole("admin", "therapist", "reception");
  const [q, setQ] = useState("");
  const [shown, setShown] = useState(PAGE);

  // Strict 500ms debounce: the filter (and any downstream work) never runs
  // per-keystroke; typing stays instant, matching runs after the pause.
  const [dq, setDq] = useState(q);
  useEffect(() => {
    const t = setTimeout(() => setDq(q), 500);
    return () => clearTimeout(t);
  }, [q]);

  const filtered = useMemo(
    () =>
      patients.filter(
        (p) =>
          !dq ||
          p.sn.includes(dq.toLowerCase()) ||
          p.pid.toLowerCase().includes(dq.toLowerCase()) ||
          p.m.includes(dq),
      ),
    [patients, dq],
  );

  const visible = filtered.slice(0, shown);
  const hasMore = filtered.length > visible.length;

  function onDelete(id: string, name: string) {
    if (!isAdmin) return;
    if (
      !confirm(
        `Permanently delete patient "${name}" and all associated visits/notes? This cannot be undone.`,
      )
    )
      return;
    store.deletePatient(id);
    toast.success("Patient record deleted");
  }

  return (
    <div>
      <Toaster />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Patients</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {patients.length} total · click to view
          </p>
        </div>
        {canCreate && (
          <Link to="/app/patients/new">
            <Button className="brand-gradient text-white border-0">
              <Plus className="size-4" /> New Patient
            </Button>
          </Link>
        )}
      </div>

      <div className="mt-6 relative">
        <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, ID, or mobile..."
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setShown(PAGE);
          }}
          className="pl-9 h-11"
        />
      </div>

      <div className="mt-6 rounded-2xl bg-card border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">PID</th>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Age/Sex</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Mobile</th>
                <th className="text-left px-4 py-3 hidden lg:table-cell">Chief Complaint</th>
                <th className="text-left px-4 py-3">Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => {
                const age = p.dob ? new Date().getFullYear() - new Date(p.dob).getFullYear() : "—";
                const status = p.status || "active";
                const badge =
                  status === "active"
                    ? "bg-emerald-500/10 text-emerald-700"
                    : status === "completed"
                      ? "bg-blue-500/10 text-blue-700"
                      : "bg-muted text-muted-foreground";
                return (
                  <tr key={p.id} className="border-t hover:bg-surface">
                    <td className="px-4 py-3 font-mono text-xs">
                      <Link
                        to="/app/patients/$id"
                        params={{ id: p.id }}
                        className="text-brand hover:underline font-semibold"
                      >
                        {p.pid}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-medium">
                      <Link
                        to="/app/patients/$id"
                        params={{ id: p.id }}
                        className="hover:underline"
                      >
                        {p.n}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {age}/{p.g}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">{p.m}</td>
                    <td className="px-4 py-3 hidden lg:table-cell truncate max-w-xs">{p.cc}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full capitalize ${badge}`}>
                        {status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Link
                        to="/app/patients/$id"
                        params={{ id: p.id }}
                        className="text-brand text-sm font-medium hover:underline mr-2"
                      >
                        Open
                      </Link>
                      {isAdmin && (
                        <IconButton tooltip="Delete patient" onClick={() => onDelete(p.id, p.n)}>
                          <Trash2 className="size-4 text-destructive" />
                        </IconButton>
                      )}
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-muted-foreground py-12">
                    No patients match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {hasMore && (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" onClick={() => setShown((s) => s + PAGE)}>
            Load More ({filtered.length - visible.length} remaining)
          </Button>
        </div>
      )}
    </div>
  );
}
