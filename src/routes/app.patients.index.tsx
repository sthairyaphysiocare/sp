import { createFileRoute, Link } from "@tanstack/react-router";
import { store, useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Search, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/app/patients/")({
  component: Patients,
});

function Patients() {
  const patients = useStore((s) => s.patients);
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const [q, setQ] = useState("");
  const filtered = patients.filter((p) =>
    !q || p.sn.includes(q.toLowerCase()) || p.pid.toLowerCase().includes(q.toLowerCase()) || p.m.includes(q),
  );

  function onDelete(id: string, name: string) {
    if (!isAdmin) return;
    if (!confirm(`Permanently delete patient "${name}" and all associated visits/notes? This cannot be undone.`)) return;
    store.deletePatient(id);
    toast.success("Patient record deleted");
  }


  return (
    <div>
      <Toaster />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Patients</h1>
          <p className="text-sm text-muted-foreground mt-1">{patients.length} total · click to view</p>
        </div>
        <Link to="/app/patients/new"><Button className="brand-gradient text-white border-0"><Plus className="size-4" /> New Patient</Button></Link>
      </div>

      <div className="mt-6 relative">
        <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search by name, ID, or mobile..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-9 h-11" />
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
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const age = new Date().getFullYear() - new Date(p.dob).getFullYear();
                return (
                  <tr key={p.id} className="border-t hover:bg-surface">
                    <td className="px-4 py-3 font-mono text-xs">{p.pid}</td>
                    <td className="px-4 py-3 font-medium">{p.n}</td>
                    <td className="px-4 py-3">{age}/{p.g}</td>
                    <td className="px-4 py-3 hidden md:table-cell">{p.m}</td>
                    <td className="px-4 py-3 hidden lg:table-cell truncate max-w-xs">{p.cc}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Link to="/app/patients/$id" params={{ id: p.id }} className="text-brand text-sm font-medium hover:underline mr-3">Open</Link>
                      {isAdmin && (
                        <Button size="sm" variant="ghost" onClick={() => onDelete(p.id, p.n)} aria-label={`Delete ${p.n}`}>
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center text-muted-foreground py-12">No patients match your search.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
