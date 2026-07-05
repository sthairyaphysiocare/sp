import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { store, useStore, takenSlotsForDate, slotConflict } from "@/lib/store";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  FileText,
  Plus,
  Activity,
  Trash2,
  Pencil,
  Check,
  X,
  Lock,
  CalendarClock,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  COMORBIDITIES,
  type ClinicalNote,
  type Patient,
  type PatientStatus,
  type Visit,
} from "@/lib/types";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { PrescriptionDialog } from "@/components/PrescriptionDialog";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { addDaysISO, fmtDate, fmtTime12, slotsForDateBranch, todayISO } from "@/lib/date";
import { branchById, enabledBranches } from "@/lib/logo";
import { MonthYearDatePicker } from "@/components/MonthYearDatePicker";
import { IconButton } from "@/components/IconButton";

export const Route = createFileRoute("/app/patients/$id")({
  component: PatientDetail,
});

const STATUSES: PatientStatus[] = ["active", "inactive", "completed"];

function PatientDetail() {
  const { id } = useParams({ from: "/app/patients/$id" });
  const { user, hasRole } = useAuth();
  const navigate = useNavigate();
  const patient = useStore((s) => s.patients.find((p) => p.id === id));
  const visits = useStore((s) =>
    s.visits.filter((v) => v.patientId === id).sort((a, b) => a.vN - b.vN),
  );
  const notes = useStore((s) => s.notes.filter((n) => n.patientId === id));
  const branch = useStore((s) => branchById(s.settings, patient?.br));
  const branches = useStore((s) => enabledBranches(s.settings));
  const therapists = useStore((s) =>
    s.users.filter((u) => u.role === "therapist" || u.role === "admin"),
  );
  const [tab, setTab] = useState<"overview" | "visits" | "progress" | "notes" | "history">(
    "overview",
  );
  const [showRx, setShowRx] = useState(false);
  const [editing, setEditing] = useState(false);
  const isAdmin = hasRole("admin");

  function onDelete() {
    if (!patient) return;
    if (
      !confirm(
        `Permanently delete "${patient.n}" and all associated visits/notes? This cannot be undone.`,
      )
    )
      return;
    store.deletePatient(patient.id);
    toast.success("Patient record deleted");
    navigate({ to: "/app/patients" });
  }

  if (!patient) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Patient not found.</p>
        <Link to="/app/patients" className="text-brand hover:underline mt-3 inline-block">
          Back to patients
        </Link>
      </div>
    );
  }

  const status: PatientStatus = patient.status || "active";
  const isActive = status === "active";
  const age = patient.dob ? new Date().getFullYear() - new Date(patient.dob).getFullYear() : "—";
  const lastVisit = visits[visits.length - 1];
  const canClinical = hasRole("admin", "therapist");
  // Reception is explicitly granted: demographic + clinical editing and
  // patient status changes (prescriptions and visit logging stay clinical).
  const canManage = hasRole("admin", "therapist", "reception");
  const canEdit = canClinical && isActive;
  // Editing the patient record (demographic + clinical) is allowed for all
  // managing roles — including reception — while the patient is active.
  const canEditPatient = canManage && isActive;

  // Plain expression (a hook here would run conditionally after the early return above).
  const chartData = visits.map((v) => ({ visit: `V${v.vN}`, pain: v.pS, recovery: v.fi }));

  const statusBadge =
    status === "active"
      ? "bg-emerald-500/10 text-emerald-700"
      : status === "completed"
        ? "bg-blue-500/10 text-blue-700"
        : "bg-muted text-muted-foreground";

  function changeStatus(s: PatientStatus) {
    if (!patient) return;
    store.updatePatient(patient.id, { status: s });
    toast.success(`Status set to ${s}`);
  }

  return (
    <div>
      <Toaster />
      <Link
        to="/app/patients"
        className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
      >
        <ArrowLeft className="size-4" /> All patients
      </Link>

      <div className="mt-3 p-4 sm:p-6 rounded-2xl bg-card border soft-shadow flex flex-col sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center gap-0 sm:gap-4">
        <div className="min-w-0 w-full">
          <div className="flex items-center gap-2 text-xs font-mono text-brand">{patient.pid}</div>
          <h1 className="text-2xl sm:text-3xl font-bold break-words leading-tight">{patient.n}</h1>
          <p className="text-sm text-muted-foreground leading-relaxed flex flex-wrap gap-x-2">
            <span className="whitespace-nowrap">{age} yrs</span>
            <span aria-hidden>·</span>
            <span className="whitespace-nowrap">
              {patient.g === "M" ? "Male" : patient.g === "F" ? "Female" : "Other"}
            </span>
            <span aria-hidden>·</span>
            <span className="whitespace-nowrap">{patient.m}</span>
          </p>
          <div className="mt-1 flex flex-wrap gap-2 items-center">
            {branch && (
              <span className="text-xs inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent text-brand font-medium whitespace-nowrap">
                {branch.name}
              </span>
            )}
            <span
              className={`text-xs px-2 py-0.5 rounded-full capitalize font-medium whitespace-nowrap ${statusBadge}`}
            >
              {status}
            </span>
            {canManage && (
              <select
                value={status}
                onChange={(e) => changeStatus(e.target.value as PatientStatus)}
                className="text-xs h-7 px-2 rounded-md border bg-background capitalize"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:shrink-0 mt-4 sm:mt-0">
          {canClinical && (
            <Button
              onClick={() => setShowRx(true)}
              disabled={!isActive}
              className="brand-gradient text-white border-0"
            >
              <FileText className="size-4" /> Prescription
            </Button>
          )}
          {canManage && (
            <Button variant="outline" onClick={() => setEditing(true)} disabled={!isActive}>
              {isActive ? (
                <>
                  <Pencil className="size-4" /> Edit
                </>
              ) : (
                <>
                  <Lock className="size-4" /> Locked
                </>
              )}
            </Button>
          )}
          {isAdmin && (
            <Button
              variant="outline"
              onClick={onDelete}
              className="text-destructive border-destructive/40 hover:bg-destructive/10"
            >
              <Trash2 className="size-4" /> Delete
            </Button>
          )}
        </div>
      </div>

      <NextReviewSection patient={patient} isActive={isActive} />

      {!isActive && canManage && (
        <div className="mt-4 p-3 rounded-lg bg-muted/60 border text-sm flex items-center gap-2">
          <Lock className="size-4 text-muted-foreground" />
          <span>
            This patient is {status}. Set status to <strong>Active</strong> to edit clinical
            details.
          </span>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-1 border-b">
        {(["overview", "visits", "progress", "notes", "history"] as const).map((t) => {
          if (!canClinical && (t === "progress" || t === "notes")) return null;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium capitalize border-b-2 -mb-px ${tab === t ? "border-brand text-brand" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
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
              <Row
                k="Emergency"
                v={
                  patient.emN || patient.emP
                    ? `${patient.emN || ""} ${patient.emP || ""}`.trim()
                    : patient.em || "—"
                }
              />
              <Row k="Blood Group" v={patient.bg || "—"} />
              <Row k="Height / Weight" v={`${patient.h || "—"} cm / ${patient.w || "—"} kg`} />
              <Row k="Therapist" v={therapists.find((t) => t.id === patient.tId)?.name || "—"} />
            </Card>
            {canManage && (
              <Card title="Clinical">
                <Row k="Chief Complaint" v={patient.cc || "—"} />
                <Row k="HPI" v={patient.pi || "—"} />
                <Row k="Surgical" v={patient.sx || "—"} />
                <Row k="Medications" v={patient.med || "—"} />
                <Row k="Allergies" v={patient.al || "—"} />
                <Row
                  k="Comorbidities"
                  v={
                    patient.cm.length
                      ? patient.cm.map((id) => COMORBIDITIES[id]).join(", ")
                      : "None"
                  }
                />
              </Card>
            )}
          </div>
        )}

        {tab === "visits" && (
          <VisitsTab
            patient={patient}
            visits={visits}
            canEdit={canEdit}
            therapistId={user?.id || ""}
            therapistName={user?.name || ""}
          />
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
                    <YAxis yAxisId="left" domain={[0, 10]} />
                    <YAxis yAxisId="right" orientation="right" domain={[0, 100]} />
                    <Tooltip />
                    <Legend />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="pain"
                      stroke="#ef4444"
                      strokeWidth={2.5}
                      name="Pain Score"
                      dot={{ r: 4 }}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="recovery"
                      stroke="#0284c7"
                      strokeWidth={2.5}
                      name="Recovery %"
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-3">
              Left axis: VAS/NPRS (0–10). Right axis: functional recovery (0–100%).
            </p>
          </div>
        )}

        {tab === "notes" && canClinical && (
          <NotesTab
            patientId={patient.id}
            notes={notes}
            authorName={user?.name || ""}
            canEdit={isActive}
          />
        )}
        {tab === "history" && canClinical && (
          <PrescriptionHistoryTab patient={patient} lastVisit={lastVisit} />
        )}
      </div>

      {editing && canEditPatient && (
        <EditPatientDialog
          patient={patient}
          branches={branches}
          therapists={therapists}
          onClose={() => setEditing(false)}
        />
      )}

      {showRx && canClinical && isActive && (
        <PrescriptionDialog
          patient={patient}
          lastVisit={lastVisit}
          onClose={() => setShowRx(false)}
        />
      )}
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
      <div className="break-words">{v}</div>
    </div>
  );
}

/**
 * Next Review — visible to Admin, Therapist and Reception. Highlights an
 * upcoming scheduled review; when blank, offers standalone scheduling that
 * enforces the same guardrails as Log Visit: dates from tomorrow only,
 * branch working hours, and duration-aware no-double-booking masking.
 */
function NextReviewSection({ patient, isActive }: { patient: Patient; isActive: boolean }) {
  const visits = useStore((s) => s.visits.filter((v) => v.patientId === patient.id));
  const branch = useStore((s) => s.settings.branches.find((b) => b.id === patient.br));
  const { user, hasRole } = useAuth();
  // Scheduling is available to managing roles ONLY while the patient is
  // active. Inactive/completed patients show the review read-only (locked).
  const canSchedule = hasRole("admin", "therapist", "reception") && isActive;
  const lastVisit = visits[visits.length - 1];
  const scheduled = lastVisit?.nxt ? { date: lastVisit.nxt, time: lastVisit.nxtTm } : null;

  const [open, setOpen] = useState(false);
  const [d, setD] = useState("");
  const [t, setT] = useState("");
  const [dur, setDur] = useState(lastVisit?.dur ?? 30);
  const taken = useStore((s) => takenSlotsForDate(s, d, lastVisit?.id));
  const slots = slotsForDateBranch(d, branch);
  const minDate = addDaysISO(todayISO(), 1);

  // When scheduling isn't available (patient inactive/completed, or a
  // non-managing role) still SHOW the review if one exists — read-only and
  // clearly locked — rather than hiding it entirely.
  if (!canSchedule) {
    if (!hasRole("admin", "therapist", "reception")) return null;
    return (
      <div className="mt-4 p-4 rounded-2xl border bg-muted/50 flex flex-wrap items-center gap-3">
        <Lock className="size-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Next Review</div>
          {scheduled ? (
            <div className="text-sm font-semibold">
              {fmtDate(scheduled.date)}
              {scheduled.time ? ` · ${fmtTime12(scheduled.time)}` : ""}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">—</div>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          Scheduling locked — patient is not active
        </span>
      </div>
    );
  }

  function cancelEdit() {
    // Reset to the previously saved values (or blank if none existed) and
    // collapse back to the clean, read-only display — no data is written.
    setD(scheduled?.date ?? "");
    setT(scheduled?.time ?? "");
    setDur(lastVisit?.dur ?? 30);
    setOpen(false);
  }

  function save() {
    if (!d || !t) {
      toast.error("Pick a date and time");
      return;
    }
    if (d <= todayISO()) {
      toast.error("Next review date must be from tomorrow onwards");
      return;
    }
    const conflict = slotConflict(store.get(), d, t, dur || 30, lastVisit?.id);
    if (conflict === "overlap") {
      toast.error("Duration exceeds available time before next appointment");
      return;
    }
    if (conflict === "taken") {
      toast.error("That time is already booked. Please pick another.");
      return;
    }
    if (lastVisit) {
      store.updateVisit(lastVisit.id, { nxt: d, nxtTm: t, dur });
    } else {
      store.addVisit({
        patientId: patient.id,
        dt: todayISO(),
        tId: user?.id || "",
        tN: user?.name || "",
        pS: 0,
        sym: "",
        rom: "",
        str: "",
        tx: "Review scheduled directly (no visit logged).",
        adv: "",
        fi: 0,
        nxt: d,
        nxtTm: t,
        dur,
      });
    }
    toast.success(`Next review set for ${fmtDate(d)} at ${fmtTime12(t)}`);
    setOpen(false);
    setD("");
    setT("");
  }

  return (
    <div
      className={cn(
        "mt-4 p-4 rounded-2xl border flex flex-wrap items-center gap-3",
        scheduled ? "bg-accent/60 border-brand/40 soft-shadow" : "bg-card",
      )}
    >
      <CalendarClock
        className={cn("size-5 shrink-0", scheduled ? "text-brand" : "text-muted-foreground")}
      />
      <div className="min-w-0 flex-1">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Next Review</div>
        {scheduled ? (
          <div className="text-sm font-bold text-brand">
            {fmtDate(scheduled.date)}
            {scheduled.time ? ` · ${fmtTime12(scheduled.time)}` : ""}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">—</div>
        )}
      </div>
      <Button
        size="sm"
        variant={scheduled ? "outline" : "default"}
        className={scheduled ? "" : "brand-gradient text-white border-0"}
        onClick={() => {
          setD(scheduled?.date && scheduled.date >= minDate ? scheduled.date : "");
          setT(scheduled?.time || "");
          setOpen((o) => !o);
        }}
      >
        <CalendarClock className="size-4" /> {scheduled ? "Reschedule" : "Schedule Review"}
      </Button>

      {open && (
        <div className="w-full grid sm:grid-cols-[1fr_1fr_auto_auto] gap-2 pt-2 border-t border-brand/10">
          <div>
            <Label className="text-xs">Date (from tomorrow)</Label>
            <Input
              type="date"
              min={minDate}
              value={d}
              onChange={(e) => {
                setD(e.target.value);
                setT("");
              }}
            />
          </div>
          <div>
            <Label className="text-xs">Time (branch hours)</Label>
            <select
              value={t}
              onChange={(e) => setT(e.target.value)}
              className="w-full h-9 px-2 rounded-md border bg-background text-sm"
            >
              <option value="">Select Time</option>
              {slots.map((sl) => (
                <option key={sl} value={sl} disabled={taken.includes(sl)}>
                  {fmtTime12(sl)}
                  {taken.includes(sl) ? " — booked" : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs">Duration</Label>
            <select
              value={dur}
              onChange={(e) => setDur(Number(e.target.value))}
              className="h-9 px-2 rounded-md border bg-background text-sm"
            >
              {[30, 60, 90].map((x) => (
                <option key={x} value={x}>
                  {x} min
                </option>
              ))}
            </select>
          </div>
          <div className="self-end flex gap-2">
            <Button size="sm" variant="outline" onClick={cancelEdit}>
              <X className="size-4" /> Cancel
            </Button>
            <Button size="sm" onClick={save} className="brand-gradient text-white border-0">
              <Check className="size-4" /> Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function EditPatientDialog({
  patient,
  branches,
  therapists,
  onClose,
}: {
  patient: Patient;
  branches: { id: string; name: string }[];
  therapists: { id: string; name: string }[];
  onClose: () => void;
}) {
  const [f, setF] = useState({
    n: patient.n,
    dob: patient.dob,
    g: patient.g,
    m: patient.m,
    am: patient.am,
    e: patient.e,
    oc: patient.oc,
    emN: patient.emN || "",
    emP: patient.emP || "",
    bg: patient.bg,
    h: patient.h,
    w: patient.w,
    cc: patient.cc,
    pi: patient.pi,
    sx: patient.sx,
    med: patient.med,
    al: patient.al,
    cm: [...patient.cm],
    lf: patient.lf,
    fh: patient.fh,
    br: patient.br || branches[0]?.id || "",
    tId: patient.tId || "",
  });

  function toggleCm(id: number) {
    setF({ ...f, cm: f.cm.includes(id) ? f.cm.filter((x) => x !== id) : [...f.cm, id] });
  }

  function save() {
    const em = f.emN || f.emP ? `${f.emN} ${f.emP}`.trim() : "";
    store.updatePatient(patient.id, { ...f, em });
    toast.success("Patient updated");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 overflow-y-auto p-4">
      <div className="bg-background rounded-2xl shadow-2xl max-w-3xl mx-auto my-6">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-lg">Edit Patient · {patient.pid}</h2>
          <Button size="sm" variant="ghost" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </Button>
        </div>
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>Full Name</Label>
              <Input value={f.n} onChange={(e) => setF({ ...f, n: e.target.value })} />
            </div>
            <div>
              <Label>Date of Birth</Label>
              <MonthYearDatePicker
                value={f.dob}
                onChange={(v) => setF({ ...f, dob: v })}
                yearsBack={100}
                yearsForward={0}
              />
            </div>
            <div>
              <Label>Gender</Label>
              <select
                className="w-full h-9 px-3 rounded-md border bg-background"
                value={f.g}
                onChange={(e) => setF({ ...f, g: e.target.value as Patient["g"] })}
              >
                <option value="M">Male</option>
                <option value="F">Female</option>
                <option value="O">Other</option>
              </select>
            </div>
            <div>
              <Label>Mobile</Label>
              <Input value={f.m} onChange={(e) => setF({ ...f, m: e.target.value })} />
            </div>
            <div>
              <Label>Alternate Mobile</Label>
              <Input value={f.am} onChange={(e) => setF({ ...f, am: e.target.value })} />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={f.e} onChange={(e) => setF({ ...f, e: e.target.value })} />
            </div>
            <div>
              <Label>Occupation</Label>
              <Input value={f.oc} onChange={(e) => setF({ ...f, oc: e.target.value })} />
            </div>
            <div>
              <Label>Emergency Contact Name</Label>
              <Input value={f.emN} onChange={(e) => setF({ ...f, emN: e.target.value })} />
            </div>
            <div>
              <Label>Emergency Contact Number</Label>
              <Input value={f.emP} onChange={(e) => setF({ ...f, emP: e.target.value })} />
            </div>
            <div>
              <Label>Blood Group</Label>
              <Input value={f.bg} onChange={(e) => setF({ ...f, bg: e.target.value })} />
            </div>
            <div>
              <Label>Height (cm)</Label>
              <Input
                type="number"
                value={f.h || ""}
                onChange={(e) => setF({ ...f, h: +e.target.value })}
              />
            </div>
            <div>
              <Label>Weight (kg)</Label>
              <Input
                type="number"
                value={f.w || ""}
                onChange={(e) => setF({ ...f, w: +e.target.value })}
              />
            </div>
            <div>
              <Label>Branch</Label>
              <select
                className="w-full h-9 px-3 rounded-md border bg-background"
                value={f.br}
                onChange={(e) => setF({ ...f, br: e.target.value })}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Assigned Therapist</Label>
              <select
                className="w-full h-9 px-3 rounded-md border bg-background"
                value={f.tId}
                onChange={(e) => setF({ ...f, tId: e.target.value })}
              >
                <option value="">Unassigned</option>
                {therapists.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="border-t pt-4 space-y-3">
            <h3 className="font-semibold text-sm">Clinical</h3>
            <div>
              <Label>Chief Complaint</Label>
              <Textarea
                rows={2}
                value={f.cc}
                onChange={(e) => setF({ ...f, cc: e.target.value })}
              />
            </div>
            <div>
              <Label>HPI</Label>
              <Textarea
                rows={3}
                value={f.pi}
                onChange={(e) => setF({ ...f, pi: e.target.value })}
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Surgical History</Label>
                <Textarea
                  rows={2}
                  value={f.sx}
                  onChange={(e) => setF({ ...f, sx: e.target.value })}
                />
              </div>
              <div>
                <Label>Medications</Label>
                <Textarea
                  rows={2}
                  value={f.med}
                  onChange={(e) => setF({ ...f, med: e.target.value })}
                />
              </div>
              <div>
                <Label>Allergies</Label>
                <Input value={f.al} onChange={(e) => setF({ ...f, al: e.target.value })} />
              </div>
              <div>
                <Label>Family History</Label>
                <Input value={f.fh} onChange={(e) => setF({ ...f, fh: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Label>Lifestyle</Label>
                <Input value={f.lf} onChange={(e) => setF({ ...f, lf: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Comorbidities</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {Object.entries(COMORBIDITIES).map(([id, label]) => (
                  <button
                    type="button"
                    key={id}
                    onClick={() => toggleCm(+id)}
                    className={`px-3 py-2 min-h-11 rounded-lg text-sm border ${f.cm.includes(+id) ? "bg-brand text-white border-brand" : "bg-background"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="p-4 border-t flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button className="brand-gradient text-white border-0" onClick={save}>
            <Check className="size-4" /> Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}

function VisitsTab({
  patient,
  visits,
  canEdit,
  therapistId,
  therapistName,
}: {
  patient: Patient;
  visits: Visit[];
  canEdit: boolean;
  therapistId: string;
  therapistName: string;
}) {
  const [show, setShow] = useState(false);
  const [editVid, setEditVid] = useState<string | null>(null);
  const [v, setV] = useState({
    dt: todayISO(),
    pS: 5,
    sym: "",
    rom: "",
    str: "",
    tx: "",
    adv: "",
    fi: 50,
    nxt: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
    nxtTm: "" as string,
    dur: 30,
  });
  const taken = useStore((s) => takenSlotsForDate(s, v.nxt));
  const branch = useStore((s) => s.settings.branches.find((b) => b.id === patient.br));
  const slots = slotsForDateBranch(v.nxt, branch);

  function save() {
    if (!canEdit) return;
    if (v.nxt && v.nxt <= todayISO()) {
      toast.error("Next review date must be from tomorrow onwards");
      return;
    }
    if (v.nxt && v.nxtTm) {
      const conflict = slotConflict(store.get(), v.nxt, v.nxtTm, v.dur || 30);
      if (conflict === "overlap") {
        toast.error("Duration exceeds available time before next appointment");
        return;
      }
      if (conflict === "taken") {
        toast.error("That time is already booked. Please pick another.");
        return;
      }
    }
    store.addVisit({ patientId: patient.id, ...v, tId: therapistId, tN: therapistName });
    toast.success("Visit logged");
    setShow(false);
    setV({ ...v, sym: "", rom: "", str: "", tx: "", adv: "", nxtTm: "" });
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
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                value={v.dt}
                onChange={(e) => setV({ ...v, dt: e.target.value })}
              />
            </div>
            <div>
              <Label>Pain (0–10)</Label>
              <Input
                type="number"
                min={0}
                max={10}
                value={v.pS}
                onChange={(e) => setV({ ...v, pS: +e.target.value })}
              />
            </div>
            <div>
              <Label>Functional %</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={v.fi}
                onChange={(e) => setV({ ...v, fi: +e.target.value })}
              />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Symptoms</Label>
              <Textarea
                rows={2}
                value={v.sym}
                onChange={(e) => setV({ ...v, sym: e.target.value })}
              />
            </div>
            <div>
              <Label>ROM</Label>
              <Textarea
                rows={2}
                value={v.rom}
                onChange={(e) => setV({ ...v, rom: e.target.value })}
              />
            </div>
            <div>
              <Label>MMT / Strength</Label>
              <Textarea
                rows={2}
                value={v.str}
                onChange={(e) => setV({ ...v, str: e.target.value })}
              />
            </div>
            <div>
              <Label>Treatment</Label>
              <Textarea
                rows={2}
                value={v.tx}
                onChange={(e) => setV({ ...v, tx: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Home Exercise / Advice</Label>
              <Textarea
                rows={2}
                value={v.adv}
                onChange={(e) => setV({ ...v, adv: e.target.value })}
              />
            </div>
            <div>
              <Label>Next Review Date</Label>
              <Input
                type="date"
                min={addDaysISO(todayISO(), 1)}
                value={v.nxt}
                onChange={(e) => setV({ ...v, nxt: e.target.value, nxtTm: "" })}
              />
            </div>
            <div>
              <Label>Next Review Time</Label>
              <select
                className="w-full h-9 px-3 rounded-md border bg-background"
                value={v.nxtTm}
                onChange={(e) => setV({ ...v, nxtTm: e.target.value })}
              >
                <option value="">Select Time</option>
                {slots.map((s) => (
                  <option key={s} value={s} disabled={taken.includes(s)}>
                    {s}
                    {taken.includes(s) ? " (booked)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Duration (min)</Label>
              <select
                className="w-full h-9 px-3 rounded-md border bg-background"
                value={v.dur}
                onChange={(e) => setV({ ...v, dur: +e.target.value })}
              >
                {[30, 60, 90, 120].map((d) => (
                  <option key={d} value={d}>
                    {d} min
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={save} className="brand-gradient text-white border-0">
              Save Visit
            </Button>
            <Button variant="outline" onClick={() => setShow(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {visits.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-12">No visits logged yet.</p>
        )}
        {[...visits].reverse().map((vis) =>
          editVid === vis.id ? (
            <VisitEdit key={vis.id} visit={vis} onClose={() => setEditVid(null)} />
          ) : (
            <div key={vis.id} className="p-5 rounded-2xl bg-card border">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-lg brand-gradient grid place-items-center text-white text-sm font-bold">
                    V{vis.vN}
                  </div>
                  <div>
                    <div className="font-semibold">{fmtDate(vis.dt)}</div>
                    <div className="text-xs text-muted-foreground">{vis.tN}</div>
                  </div>
                </div>
                <div className="flex gap-2 items-center text-xs">
                  <span className="px-2 py-1 rounded bg-red-500/10 text-red-700">
                    Pain {vis.pS}/10
                  </span>
                  <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-700">
                    Recovery {vis.fi}%
                  </span>
                  {canEdit && (
                    <IconButton tooltip="Edit visit" onClick={() => setEditVid(vis.id)}>
                      <Pencil className="size-4" />
                    </IconButton>
                  )}
                </div>
              </div>
              <div className="mt-3 grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                {vis.sym && (
                  <div>
                    <span className="text-muted-foreground text-xs uppercase">Symptoms: </span>
                    {vis.sym}
                  </div>
                )}
                {vis.rom && (
                  <div>
                    <span className="text-muted-foreground text-xs uppercase">ROM: </span>
                    {vis.rom}
                  </div>
                )}
                {vis.str && (
                  <div>
                    <span className="text-muted-foreground text-xs uppercase">MMT: </span>
                    {vis.str}
                  </div>
                )}
                {vis.tx && (
                  <div>
                    <span className="text-muted-foreground text-xs uppercase">Tx: </span>
                    {vis.tx}
                  </div>
                )}
                {vis.adv && (
                  <div className="sm:col-span-2">
                    <span className="text-muted-foreground text-xs uppercase">HEP: </span>
                    {vis.adv}
                  </div>
                )}
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  );
}

function VisitEdit({ visit, onClose }: { visit: Visit; onClose: () => void }) {
  const [v, setV] = useState({ ...visit });
  function save() {
    store.updateVisit(visit.id, v);
    toast.success("Visit updated");
    onClose();
  }
  return (
    <div className="p-5 rounded-2xl bg-card border border-brand/40 space-y-3">
      <div className="font-semibold">Edit Visit V{visit.vN}</div>
      <div className="grid sm:grid-cols-3 gap-3">
        <div>
          <Label>Date</Label>
          <Input type="date" value={v.dt} onChange={(e) => setV({ ...v, dt: e.target.value })} />
        </div>
        <div>
          <Label>Pain</Label>
          <Input
            type="number"
            min={0}
            max={10}
            value={v.pS}
            onChange={(e) => setV({ ...v, pS: +e.target.value })}
          />
        </div>
        <div>
          <Label>Recovery %</Label>
          <Input
            type="number"
            min={0}
            max={100}
            value={v.fi}
            onChange={(e) => setV({ ...v, fi: +e.target.value })}
          />
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Label>Symptoms</Label>
          <Textarea rows={2} value={v.sym} onChange={(e) => setV({ ...v, sym: e.target.value })} />
        </div>
        <div>
          <Label>ROM</Label>
          <Textarea rows={2} value={v.rom} onChange={(e) => setV({ ...v, rom: e.target.value })} />
        </div>
        <div>
          <Label>MMT</Label>
          <Textarea rows={2} value={v.str} onChange={(e) => setV({ ...v, str: e.target.value })} />
        </div>
        <div>
          <Label>Treatment</Label>
          <Textarea rows={2} value={v.tx} onChange={(e) => setV({ ...v, tx: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <Label>Advice</Label>
          <Textarea rows={2} value={v.adv} onChange={(e) => setV({ ...v, adv: e.target.value })} />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button className="brand-gradient text-white border-0" onClick={save}>
          <Check className="size-4" /> Save
        </Button>
      </div>
    </div>
  );
}

interface HistoryRow {
  id: string;
  receiptNo: string | null;
  data: string;
  createdAt: number;
}

interface ParsedHistory {
  rx: {
    concern: string;
    diagnosis: string;
    manualTherapy: string;
    modalities: string;
    exercises: string;
    advice: string;
    reviewDate: string;
    reviewTime: string;
  };
  receipt: {
    no: string;
    mode: string;
    items: Array<{ id: string; desc: string; qty: number; rate: number }>;
    paid: number;
    notes: string;
  };
  receiptOn: boolean;
  savedAt: number;
}

function PrescriptionHistoryTab({ patient, lastVisit }: { patient: Patient; lastVisit?: Visit }) {
  const [rows, setRows] = useState<HistoryRow[] | null>(null);
  const [viewing, setViewing] = useState<ParsedHistory | null>(null);

  useEffect(() => {
    let cancelled = false;
    import("@/lib/db.functions")
      .then(({ listPrescriptions }) => listPrescriptions({ data: { patientId: patient.id } }))
      .then((r) => !cancelled && setRows(r))
      .catch((err) => {
        console.error("Couldn't load prescription history:", err);
        if (!cancelled) setRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [patient.id]);

  function open(row: HistoryRow) {
    try {
      const parsed = JSON.parse(row.data) as ParsedHistory;
      setViewing({
        ...parsed,
        receipt: { ...parsed.receipt, no: row.receiptNo || parsed.receipt.no },
      });
    } catch (err) {
      console.error("Corrupt prescription history record:", err);
      toast.error("Couldn't open this record");
    }
  }

  if (rows === null) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Loading history…</p>;
  }
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        No saved prescriptions yet. Use "Save, Preview &amp; Print" inside a prescription to record
        one here.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => {
        let diagnosis = "—";
        let total = 0;
        let hasReceipt = false;
        try {
          const parsed = JSON.parse(row.data) as ParsedHistory;
          diagnosis = parsed.rx.diagnosis || parsed.rx.concern || "—";
          hasReceipt = !!parsed.receiptOn && parsed.receipt.items.length > 0;
          total = parsed.receipt.items.reduce(
            (sum, it) => sum + (Number(it.qty) || 0) * (Number(it.rate) || 0),
            0,
          );
        } catch {
          /* fall back to defaults above */
        }
        return (
          <div
            key={row.id}
            className="p-4 rounded-2xl bg-card border flex flex-wrap items-center gap-3"
          >
            <FileText className="size-5 shrink-0 text-brand" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate">{diagnosis}</div>
              <div className="text-xs text-muted-foreground">
                {fmtDate(new Date(row.createdAt))}
                {row.receiptNo && <> · Receipt {row.receiptNo}</>}
                {hasReceipt && <> · ₹ {total.toLocaleString("en-IN")}</>}
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => open(row)}>
              <Eye className="size-4" /> View Document
            </Button>
          </div>
        );
      })}

      {viewing && (
        <PrescriptionDialog
          patient={patient}
          lastVisit={lastVisit}
          historical={viewing}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}

function NotesTab({
  patientId,
  notes,
  authorName,
  canEdit,
}: {
  patientId: string;
  notes: ClinicalNote[];
  authorName: string;
  canEdit: boolean;
}) {
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
      {canEdit && (
        <div className="p-5 rounded-2xl bg-card border">
          <Label>Add Clinical Note</Label>
          <Textarea
            rows={3}
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            className="mt-2"
          />
          <Button onClick={add} className="mt-3 brand-gradient text-white border-0">
            Add Note
          </Button>
        </div>
      )}
      <div className="space-y-2">
        {notes.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No notes yet.</p>
        )}
        {[...notes].reverse().map((n) => (
          <div key={n.id} className="p-4 rounded-xl bg-card border">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{n.tN}</span>
              <span>
                {fmtDate(n.dt)} · {n.tm}
              </span>
            </div>
            <div className="mt-2 text-sm">{n.msg}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
