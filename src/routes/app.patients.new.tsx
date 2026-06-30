import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { store, useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MonthYearDatePicker } from "@/components/MonthYearDatePicker";
import { useState } from "react";
import { COMORBIDITIES } from "@/lib/types";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { enabledBranches } from "@/lib/logo";

export const Route = createFileRoute("/app/patients/new")({
  component: NewPatient,
});

function NewPatient() {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const canCreate = hasRole("admin", "therapist", "reception");
  const branches = useStore((s) => enabledBranches(s.settings));
  const therapists = useStore((s) => s.users.filter((u) => u.role === "therapist"));
  const nextPid = store.nextPid();
  const defaultTherapist = therapists[0]?.id || "";
  const [f, setF] = useState({
    n: "", dob: "", g: "M" as "M" | "F" | "O", m: "", am: "", e: "", oc: "",
    em: "", emN: "", emP: "",
    bg: "", h: 0, w: 0, cc: "", pi: "", sx: "", med: "", al: "", cm: [] as number[], lf: "", fh: "",
    br: branches[0]?.id || "",
    tId: defaultTherapist,
    status: "active" as const,
  });

  if (!canCreate) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-semibold">Read-only access</h2>
        <p className="text-muted-foreground mt-2">Your role does not permit creating new patients.</p>
        <Link to="/app/patients" className="mt-4 inline-block text-brand hover:underline">← Back to patients</Link>
      </div>
    );
  }


  function toggleCm(id: number) {
    setF({ ...f, cm: f.cm.includes(id) ? f.cm.filter((x) => x !== id) : [...f.cm, id] });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.n || !f.m) { toast.error("Name and mobile required"); return; }
    if (!f.br) { toast.error("Please select a branch"); return; }
    const em = f.emN || f.emP ? `${f.emN} ${f.emP}`.trim() : "";
    const p = store.addPatient({ ...f, em });
    toast.success(`Patient ${p.pid} created`);
    navigate({ to: "/app/patients/$id", params: { id: p.id } });
  }

  return (
    <div>
      <Toaster />
      <Link to="/app/patients" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><ArrowLeft className="size-4" /> Back</Link>
      <h1 className="text-2xl sm:text-3xl font-bold mt-2">New Patient</h1>
      <p className="text-sm text-muted-foreground mt-1">Auto-assigned ID: <span className="font-mono text-brand">{nextPid}</span></p>

      <form onSubmit={submit} className="mt-6 space-y-6">
        <section className="p-6 rounded-2xl bg-card border space-y-4">
          <h2 className="font-semibold">Demographics</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div><Label>Full Name *</Label><Input value={f.n} onChange={(e) => setF({ ...f, n: e.target.value })} required /></div>
            <div>
              <Label>Date of Birth</Label>
              <MonthYearDatePicker value={f.dob} onChange={(v) => setF({ ...f, dob: v })} yearsBack={100} yearsForward={0} />
            </div>
            <div>
              <Label>Gender</Label>
              <select className="w-full h-9 px-3 rounded-md border bg-background" value={f.g} onChange={(e) => setF({ ...f, g: e.target.value as any })}>
                <option value="M">Male</option><option value="F">Female</option><option value="O">Other</option>
              </select>
            </div>
            <div><Label>Mobile *</Label><Input value={f.m} onChange={(e) => setF({ ...f, m: e.target.value })} required /></div>
            <div><Label>Alternate Mobile</Label><Input value={f.am} onChange={(e) => setF({ ...f, am: e.target.value })} /></div>
            <div><Label>Email</Label><Input type="email" value={f.e} onChange={(e) => setF({ ...f, e: e.target.value })} /></div>
            <div><Label>Occupation</Label><Input value={f.oc} onChange={(e) => setF({ ...f, oc: e.target.value })} /></div>
            <div><Label>Emergency Contact Name</Label><Input value={f.emN} onChange={(e) => setF({ ...f, emN: e.target.value })} /></div>
            <div><Label>Emergency Contact Number</Label><Input value={f.emP} onChange={(e) => setF({ ...f, emP: e.target.value })} /></div>
            <div>
              <Label>Treating Branch *</Label>
              <select className="w-full h-9 px-3 rounded-md border bg-background" value={f.br}
                      onChange={(e) => setF({ ...f, br: e.target.value })} required>
                <option value="">Select branch…</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <Label>Assigned Therapist</Label>
              <select className="w-full h-9 px-3 rounded-md border bg-background" value={f.tId}
                      onChange={(e) => setF({ ...f, tId: e.target.value })}>
                <option value="">Unassigned</option>
                {therapists.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
        </section>

        <section className="p-6 rounded-2xl bg-card border space-y-4">
          <h2 className="font-semibold">Vitals</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            <div><Label>Blood Group</Label><Input value={f.bg} onChange={(e) => setF({ ...f, bg: e.target.value })} /></div>
            <div><Label>Height (cm)</Label><Input type="number" value={f.h || ""} onChange={(e) => setF({ ...f, h: +e.target.value })} /></div>
            <div><Label>Weight (kg)</Label><Input type="number" value={f.w || ""} onChange={(e) => setF({ ...f, w: +e.target.value })} /></div>
          </div>
        </section>

        {hasRole("admin", "therapist") && (
          <section className="p-6 rounded-2xl bg-card border space-y-4">
            <h2 className="font-semibold">Clinical History</h2>
            <div><Label>Chief Complaint</Label><Textarea rows={2} value={f.cc} onChange={(e) => setF({ ...f, cc: e.target.value })} /></div>
            <div><Label>History of Present Illness</Label><Textarea rows={3} value={f.pi} onChange={(e) => setF({ ...f, pi: e.target.value })} /></div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div><Label>Surgical History</Label><Textarea rows={2} value={f.sx} onChange={(e) => setF({ ...f, sx: e.target.value })} /></div>
              <div><Label>Current Medications</Label><Textarea rows={2} value={f.med} onChange={(e) => setF({ ...f, med: e.target.value })} /></div>
              <div><Label>Allergies</Label><Input value={f.al} onChange={(e) => setF({ ...f, al: e.target.value })} /></div>
              <div><Label>Family History</Label><Input value={f.fh} onChange={(e) => setF({ ...f, fh: e.target.value })} /></div>
              <div className="sm:col-span-2"><Label>Lifestyle</Label><Input value={f.lf} onChange={(e) => setF({ ...f, lf: e.target.value })} /></div>
            </div>
            <div>
              <Label>Comorbidities</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {Object.entries(COMORBIDITIES).map(([id, label]) => (
                  <button type="button" key={id}
                    onClick={() => toggleCm(+id)}
                    className={`px-3 py-2 min-h-11 rounded-lg text-sm border ${f.cm.includes(+id) ? "bg-brand text-white border-brand" : "bg-background"}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        <div className="flex gap-3">
          <Button type="submit" size="lg" className="brand-gradient text-white border-0">Create Patient</Button>
          <Link to="/app/patients"><Button type="button" size="lg" variant="outline">Cancel</Button></Link>
        </div>
      </form>
    </div>
  );
}
