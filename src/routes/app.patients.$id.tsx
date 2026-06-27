import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { store, useStore, takenSlotsForDate } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { useMemo, useState } from "react";
import { ArrowLeft, FileText, Plus, Activity, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { COMORBIDITIES } from "@/lib/types";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { PrescriptionDialog } from "@/components/PrescriptionDialog";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { fmtDate } from "@/lib/date";
import { slotsForDate } from "@/lib/date";

export const Route = createFileRoute("/app/patients/$id")({
  component: PatientDetail,
});

function PatientDetail() {
  const { id } = useParams({ from: "/app/patients/$id" });
  const { user, hasRole } = useAuth();
  const navigate = useNavigate();
  const patient = useStore((s) => s.patients.find((p) => p.id === id));
  const visits = useStore((s) => s.visits.filter((v) => v.patientId === id).sort((a, b) => a.vN - b.vN));
  const notes = useStore((s) => s.notes.filter((n) => n.patientId === id));
  const [tab, setTab] = useState<"overview" | "visits" | "progress" | "notes">("overview");
  const [showRx, setShowRx] = useState(false);
  const isAdmin = hasRole("admin");

  function onDelete() {
    if (!patient) return;
    if (!confirm(`Permanently delete "${patient.n}" and all associated visits/notes? This cannot be undone.`)) return;
    store.deletePatient(patient.id);
    toast.success("Patient record deleted");
    navigate({ to: "/app/patients" });
  }

  if (!patient) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Patient not found.</p>
        <Link to="/app/patients" className="text-brand hover:underline mt-3 inline-block">Back to patients</Link>
      </div>
    );
  }

  const age = patient.dob ? new Date().getFullYear() - new Date(patient.dob).getFullYear() : "—";
  const lastVisit = visits[visits.length - 1];
  const canClinical = hasRole("admin", "therapist");

  const chartData = useMemo(
    () => visits.map((v) => ({ visit: `V${v.vN}`, pain: v.pS, recovery: v.fi })),
    [visits],
  );

  return (
    <div>
      <Toaster />
      <Link to="/app/patients" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><ArrowLeft className="size-4" /> All patients</Link>

      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-mono text-brand">{patient.pid}</div>
          <h1 className="text-2xl sm:text-3xl font-bold truncate">{patient.n}</h1>
          <p className="text-sm text-muted-foreground">{age} yrs · {patient.g === "M" ? "Male" : patient.g === "F" ? "Female" : "Other"} · {patient.m}</p>
        </div>
        {canClinical && (
          <Button onClick={() => setShowRx(true)} className="brand-gradient text-white border-0 shrink-0">
            <FileText className="size-4" /> Prescription
          </Button>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-1 border-b">
        {(["overview", "visits", "progress", "notes"] as const).map((t) => {
          if (!canClinical && (t === "progress" || t === "notes")) return null;
          return (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium capitalize border-b-2 -mb-px ${tab === t ? "border-brand text-brand" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {t}
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        {tab === "overview" && (
          <div className="grid lg:grid-cols-2 gap-4">
            <Card title="Demographics">
              <Row k="Email" v={patient.e || "—"} />
              <Row k="Occupation" v={patient.oc || "—"} />
              <Row k="Emergency" v={patient.em || "—"} />
              <Row k="Blood Group" v={patient.bg || "—"} />
              <Row k="Height / Weight" v={`${patient.h || "—"} cm / ${patient.w || "—"} kg`} />
            </Card>
            {canClinical && (
              <Card title="Clinical">
                <Row k="Chief Complaint" v={patient.cc || "—"} />
                <Row k="HPI" v={patient.pi || "—"} />
                <Row k="Surgical" v={patient.sx || "—"} />
                <Row k="Medications" v={patient.med || "—"} />
                <Row k="Allergies" v={patient.al || "—"} />
                <Row k="Comorbidities" v={patient.cm.length ? patient.cm.map((id) => COMORBIDITIES[id]).join(", ") : "None"} />
              </Card>
            )}
          </div>
        )}

        {tab === "visits" && (
          <VisitsTab patientId={patient.id} visits={visits} canEdit={canClinical} therapistId={user?.id || ""} therapistName={user?.name || ""} />
        )}

        {tab === "progress" && canClinical && (
          <div className="p-6 rounded-2xl bg-card border">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="size-5 text-brand" />
              <h2 className="font-semibold">Recovery Trajectory</h2>
            </div>
            {chartData.length === 0 ? (
              <p className="text-sm text-muted-foreground">No visits logged yet.</p>
            ) : (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="visit" />
                    <YAxis yAxisId="left" domain={[0, 10]} label={{ value: "Pain (VAS)", angle: -90, position: "insideLeft", style: { fontSize: 12 } }} />
                    <YAxis yAxisId="right" orientation="right" domain={[0, 100]} label={{ value: "Recovery %", angle: 90, position: "insideRight", style: { fontSize: 12 } }} />
                    <Tooltip />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="pain" stroke="#ef4444" strokeWidth={2.5} name="Pain Score" dot={{ r: 4 }} />
                    <Line yAxisId="right" type="monotone" dataKey="recovery" stroke="#0284c7" strokeWidth={2.5} name="Recovery %" dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-3">Left axis: VAS/NPRS pain trend (0–10). Right axis: functional recovery (0–100%).</p>
          </div>
        )}

        {tab === "notes" && canClinical && (
          <NotesTab patientId={patient.id} notes={notes} authorName={user?.name || ""} />
        )}
      </div>

      {showRx && canClinical && <PrescriptionDialog patient={patient} lastVisit={lastVisit} onClose={() => setShowRx(false)} />}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-6 rounded-2xl bg-card border">
      <h3 className="font-semibold mb-4">{title}</h3>
      <div className="space-y-2.5 text-sm">{children}</div>
    </div>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3">
      <div className="text-muted-foreground text-xs uppercase tracking-wider font-medium">{k}</div>
      <div>{v}</div>
    </div>
  );
}

function VisitsTab({ patientId, visits, canEdit, therapistId, therapistName }: {
  patientId: string; visits: any[]; canEdit: boolean; therapistId: string; therapistName: string;
}) {
  const [show, setShow] = useState(false);
  const [v, setV] = useState({
    dt: new Date().toISOString().slice(0, 10),
    pS: 5, sym: "", rom: "", str: "", tx: "", adv: "", fi: 50,
    nxt: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
  });

  function save() {
    if (!canEdit) return;
    store.addVisit({ patientId, ...v, tId: therapistId, tN: therapistName });
    toast.success("Visit logged");
    setShow(false);
    setV({ ...v, sym: "", rom: "", str: "", tx: "", adv: "" });
  }

  return (
    <div>
      {canEdit && (
        <div className="flex justify-end mb-4">
          <Button onClick={() => setShow(!show)} className="brand-gradient text-white border-0">
            <Plus className="size-4" /> Log Visit
          </Button>
        </div>
      )}
      {show && canEdit && (
        <div className="p-6 rounded-2xl bg-card border mb-4 space-y-4">
          <div className="grid sm:grid-cols-3 gap-3">
            <div><Label>Date</Label><Input type="date" value={v.dt} onChange={(e) => setV({ ...v, dt: e.target.value })} /></div>
            <div><Label>Pain (0–10)</Label><Input type="number" min={0} max={10} value={v.pS} onChange={(e) => setV({ ...v, pS: +e.target.value })} /></div>
            <div><Label>Functional %</Label><Input type="number" min={0} max={100} value={v.fi} onChange={(e) => setV({ ...v, fi: +e.target.value })} /></div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div><Label>Symptoms</Label><Textarea rows={2} value={v.sym} onChange={(e) => setV({ ...v, sym: e.target.value })} /></div>
            <div><Label>ROM</Label><Textarea rows={2} value={v.rom} onChange={(e) => setV({ ...v, rom: e.target.value })} /></div>
            <div><Label>MMT / Strength</Label><Textarea rows={2} value={v.str} onChange={(e) => setV({ ...v, str: e.target.value })} /></div>
            <div><Label>Treatment</Label><Textarea rows={2} value={v.tx} onChange={(e) => setV({ ...v, tx: e.target.value })} /></div>
            <div className="sm:col-span-2"><Label>Home Exercise / Advice</Label><Textarea rows={2} value={v.adv} onChange={(e) => setV({ ...v, adv: e.target.value })} /></div>
            <div><Label>Next Review</Label><Input type="date" value={v.nxt} onChange={(e) => setV({ ...v, nxt: e.target.value })} /></div>
          </div>
          <div className="flex gap-2">
            <Button onClick={save} className="brand-gradient text-white border-0">Save Visit</Button>
            <Button variant="outline" onClick={() => setShow(false)}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {visits.length === 0 && <p className="text-sm text-muted-foreground text-center py-12">No visits logged yet.</p>}
        {[...visits].reverse().map((vis) => (
          <div key={vis.id} className="p-5 rounded-2xl bg-card border">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg brand-gradient grid place-items-center text-white text-sm font-bold">V{vis.vN}</div>
                <div>
                  <div className="font-semibold">{new Date(vis.dt).toLocaleDateString("en-IN")}</div>
                  <div className="text-xs text-muted-foreground">{vis.tN}</div>
                </div>
              </div>
              <div className="flex gap-2 text-xs">
                <span className="px-2 py-1 rounded bg-red-500/10 text-red-700">Pain {vis.pS}/10</span>
                <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-700">Recovery {vis.fi}%</span>
              </div>
            </div>
            <div className="mt-3 grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              {vis.sym && <div><span className="text-muted-foreground text-xs uppercase">Symptoms: </span>{vis.sym}</div>}
              {vis.rom && <div><span className="text-muted-foreground text-xs uppercase">ROM: </span>{vis.rom}</div>}
              {vis.str && <div><span className="text-muted-foreground text-xs uppercase">MMT: </span>{vis.str}</div>}
              {vis.tx && <div><span className="text-muted-foreground text-xs uppercase">Tx: </span>{vis.tx}</div>}
              {vis.adv && <div className="sm:col-span-2"><span className="text-muted-foreground text-xs uppercase">HEP: </span>{vis.adv}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NotesTab({ patientId, notes, authorName }: { patientId: string; notes: any[]; authorName: string }) {
  const [msg, setMsg] = useState("");
  function add() {
    if (!msg.trim()) return;
    const now = new Date();
    store.addNote({
      patientId,
      dt: now.toISOString().slice(0, 10),
      tm: now.toTimeString().slice(0, 5),
      tN: authorName,
      msg: msg.trim(),
    });
    setMsg("");
    toast.success("Note added");
  }
  return (
    <div className="space-y-4">
      <div className="p-5 rounded-2xl bg-card border">
        <Label>Add Clinical Note</Label>
        <Textarea rows={3} value={msg} onChange={(e) => setMsg(e.target.value)} className="mt-2" placeholder="Progress observation, plan update..." />
        <Button onClick={add} className="mt-3 brand-gradient text-white border-0">Add Note</Button>
      </div>
      <div className="space-y-2">
        {notes.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No notes yet.</p>}
        {[...notes].reverse().map((n) => (
          <div key={n.id} className="p-4 rounded-xl bg-card border">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{n.tN}</span>
              <span>{n.dt} · {n.tm}</span>
            </div>
            <div className="mt-2 text-sm">{n.msg}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
