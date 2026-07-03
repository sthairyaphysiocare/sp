import { createFileRoute } from "@tanstack/react-router";
import { DEFAULT_HOURS, store, useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import {
  Globe,
  MapPin,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  Award,
  BarChart3,
  Users,
  Camera,
} from "lucide-react";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { ICON_OPTIONS } from "@/lib/icons";
import type { Branch, BranchHours, Clinician, PublicStats, SpecialityItem } from "@/lib/types";

export const Route = createFileRoute("/app/settings")({
  component: Settings,
});

const DAYS: { k: keyof BranchHours; label: string }[] = [
  { k: "mon", label: "Mon" },
  { k: "tue", label: "Tue" },
  { k: "wed", label: "Wed" },
  { k: "thu", label: "Thu" },
  { k: "fri", label: "Fri" },
  { k: "sat", label: "Sat" },
  { k: "sun", label: "Sun" },
];

const EMPTY_HOURS: BranchHours = { mon: "", tue: "", wed: "", thu: "", fri: "", sat: "", sun: "" };

function Settings() {
  const { user, hasRole } = useAuth();
  const settings = useStore((s) => s.settings);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [wa, setWa] = useState(settings.whatsappNumber || "");
  const [gEmail, setGEmail] = useState(settings.globalEmail || "");
  const [links, setLinks] = useState({
    globalUrl: settings.globalUrl || "",
    redirectUrl1: settings.redirectUrl1 || "",
    redirectUrl2: settings.redirectUrl2 || "",
    prescriptionUrl: settings.prescriptionUrl || "sthairyaphysiocare.pages.dev",
    prescriptionUrlEnabled: settings.prescriptionUrlEnabled !== false,
  });
  const [stats, setStats] = useState<PublicStats>(settings.stats);
  const [myEmail, setMyEmail] = useState(user?.emailId || "");

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (pw.length < 4) {
      toast.error("Password too short");
      return;
    }
    if (pw !== pw2) {
      toast.error("Passwords don't match");
      return;
    }
    store.changePassword(user.id, pw);
    setPw("");
    setPw2("");
    toast.success("Password updated");
  }

  function saveMyEmail() {
    if (!user) return;
    const v = myEmail.trim();
    if (v && !/.+@.+\..+/.test(v)) {
      toast.error("Enter a valid email");
      return;
    }
    store.updateUser(user.id, { emailId: v });
    toast.success("Email updated");
  }

  function togglePublicStats() {
    store.setSettings({ publicStatsEnabled: !settings.publicStatsEnabled });
    toast.success(`Public statistics ${!settings.publicStatsEnabled ? "enabled" : "disabled"}`);
  }

  function saveWa() {
    const digits = wa.replace(/[^0-9]/g, "");
    if (digits.length < 10) {
      toast.error("Enter a valid number");
      return;
    }
    store.setSettings({ whatsappNumber: digits });
    toast.success("WhatsApp Business number updated");
  }

  function saveLinks() {
    store.setSettings({
      globalUrl: links.globalUrl.trim(),
      redirectUrl1: links.redirectUrl1.trim(),
      redirectUrl2: links.redirectUrl2.trim(),
      prescriptionUrl: links.prescriptionUrl.trim(),
      prescriptionUrlEnabled: links.prescriptionUrlEnabled,
    });
    toast.success("Links updated");
  }

  function saveGEmail() {
    const v = gEmail.trim();
    if (v && !/.+@.+\..+/.test(v)) {
      toast.error("Enter a valid email");
      return;
    }
    store.setSettings({ globalEmail: v });
    toast.success("Global Email ID updated");
  }

  function saveStats() {
    store.setSettings({ stats });
    toast.success("Public statistics updated");
  }

  return (
    <div>
      <Toaster />
      <h1 className="text-2xl sm:text-3xl font-bold">Settings</h1>

      <form onSubmit={save} className="mt-6 p-6 rounded-2xl bg-card border max-w-xl space-y-4">
        <h2 className="font-semibold">Change Password</h2>
        <div>
          <Label>New Password</Label>
          <Input
            type="password"
            autoComplete="new-password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
          />
        </div>
        <div>
          <Label>Confirm Password</Label>
          <Input
            type="password"
            autoComplete="new-password"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
          />
        </div>
        <Button type="submit" className="brand-gradient text-white border-0">
          Update Password
        </Button>
      </form>

      <div className="mt-6 p-6 rounded-2xl bg-card border max-w-xl">
        <h2 className="font-semibold">My Email ID</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Used for password reset OTP &amp; notifications.
        </p>
        <div className="mt-3 flex gap-2 flex-wrap">
          <Input
            type="email"
            value={myEmail}
            onChange={(e) => setMyEmail(e.target.value)}
            placeholder="you@example.com"
            className="flex-1 min-w-[200px]"
          />
          <Button onClick={saveMyEmail} className="brand-gradient text-white border-0">
            Save
          </Button>
        </div>
      </div>

      {hasRole("admin") && (
        <>
          <div className="mt-6 p-6 rounded-2xl bg-card border max-w-xl">
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-lg bg-emerald-500 grid place-items-center text-white shrink-0">
                <WhatsAppIcon size={20} />
              </div>
              <div className="flex-1">
                <h2 className="font-semibold">Global WhatsApp Business Number</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Include country code (e.g. 91 for India).
                </p>
                <div className="mt-3 flex gap-2 flex-wrap">
                  <Input
                    value={wa}
                    onChange={(e) => setWa(e.target.value)}
                    placeholder="919900315254"
                    className="flex-1 min-w-[200px]"
                  />
                  <Button onClick={saveWa} className="brand-gradient text-white border-0">
                    Save
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 p-6 rounded-2xl bg-card border max-w-xl">
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-lg bg-blue-500 grid place-items-center text-white shrink-0">
                <Globe className="size-5" />
              </div>
              <div className="flex-1">
                <h2 className="font-semibold">Global Email ID</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Master fallback email for branches without a custom Email ID and outgoing OTPs.
                </p>
                <div className="mt-3 flex gap-2 flex-wrap">
                  <Input
                    type="email"
                    value={gEmail}
                    onChange={(e) => setGEmail(e.target.value)}
                    placeholder="SthairyaPhysiocare@gmail.com"
                    className="flex-1 min-w-[200px]"
                  />
                  <Button onClick={saveGEmail} className="brand-gradient text-white border-0">
                    Save
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 p-6 rounded-2xl bg-card border max-w-xl">
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-lg bg-violet-500 grid place-items-center text-white shrink-0">
                <Globe className="size-5" />
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <h2 className="font-semibold">Links &amp; URLs</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    All optional. The Global URL appears as a clickable link in the prescription
                    header after the address. The Clinic URL shows in the prescription header and
                    can be turned off.
                  </p>
                </div>
                <div>
                  <Label>Global URL</Label>
                  <Input
                    value={links.globalUrl}
                    onChange={(e) => setLinks({ ...links, globalUrl: e.target.value })}
                    placeholder="https://…"
                  />
                </div>
                <div>
                  <Label>Redirect URL 1</Label>
                  <Input
                    value={links.redirectUrl1}
                    onChange={(e) => setLinks({ ...links, redirectUrl1: e.target.value })}
                    placeholder="https://…"
                  />
                </div>
                <div>
                  <Label>Redirect URL 2</Label>
                  <Input
                    value={links.redirectUrl2}
                    onChange={(e) => setLinks({ ...links, redirectUrl2: e.target.value })}
                    placeholder="https://…"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Label>Clinic URL (prescription header)</Label>
                    <Input
                      value={links.prescriptionUrl}
                      onChange={(e) => setLinks({ ...links, prescriptionUrl: e.target.value })}
                      disabled={!links.prescriptionUrlEnabled}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm pb-2 select-none">
                    <input
                      type="checkbox"
                      checked={links.prescriptionUrlEnabled}
                      onChange={(e) =>
                        setLinks({ ...links, prescriptionUrlEnabled: e.target.checked })
                      }
                    />
                    Show
                  </label>
                </div>
                <Button onClick={saveLinks} className="brand-gradient text-white border-0">
                  Save Links
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-6 p-6 rounded-2xl bg-card border">
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-lg brand-gradient grid place-items-center text-white shrink-0">
                <BarChart3 className="size-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h2 className="font-semibold">Public Clinic Statistics</h2>
                  <Button
                    onClick={togglePublicStats}
                    variant={settings.publicStatsEnabled ? "outline" : "default"}
                    className={
                      settings.publicStatsEnabled ? "" : "brand-gradient text-white border-0"
                    }
                  >
                    {settings.publicStatsEnabled ? "Disable Public" : "Enable Public"}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Edit the four metrics shown on the public Home page.
                </p>
                <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <Label>Patients Treated</Label>
                    <Input
                      value={stats.patients}
                      onChange={(e) => setStats({ ...stats, patients: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Years of Practice</Label>
                    <Input
                      value={stats.years}
                      onChange={(e) => setStats({ ...stats, years: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Recovery Rate</Label>
                    <Input
                      value={stats.recovery}
                      onChange={(e) => setStats({ ...stats, recovery: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Specialised Programs</Label>
                    <Input
                      value={stats.programs}
                      onChange={(e) => setStats({ ...stats, programs: e.target.value })}
                    />
                  </div>
                </div>
                <Button onClick={saveStats} className="mt-4 brand-gradient text-white border-0">
                  Save Statistics
                </Button>
              </div>
            </div>
          </div>

          <BranchManager />
          <SpecialitiesManager />
          <CliniciansManager />
        </>
      )}
    </div>
  );
}

function BranchManager() {
  const branches = useStore((s) => s.settings.branches);
  const [editId, setEditId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <div className="mt-6 p-6 rounded-2xl bg-card border">
      <div className="flex items-start gap-3">
        <div className="size-10 rounded-lg brand-gradient grid place-items-center text-white shrink-0">
          <MapPin className="size-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h2 className="font-semibold">Clinic Locations &amp; Settings</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Per-branch clinic hours render on the public Contact page.
              </p>
            </div>
            <Button onClick={() => setAdding(true)} className="brand-gradient text-white border-0">
              <Plus className="size-4" /> Add Branch
            </Button>
          </div>

          <div className="mt-5 space-y-3">
            {adding && (
              <BranchEditor
                initial={{
                  name: "",
                  address: "",
                  mapUrl: "",
                  phone: "",
                  emailId: "",
                  license: "",
                  enabled: true,
                  hours: { ...EMPTY_HOURS },
                }}
                onCancel={() => setAdding(false)}
                onSave={(b) => {
                  store.addBranch(b);
                  setAdding(false);
                  toast.success("Branch added");
                }}
              />
            )}
            {branches.map((b) =>
              editId === b.id ? (
                <BranchEditor
                  key={b.id}
                  initial={b}
                  onCancel={() => setEditId(null)}
                  onSave={(patch) => {
                    store.updateBranch(b.id, patch);
                    setEditId(null);
                    toast.success("Branch updated");
                  }}
                />
              ) : (
                <BranchRow
                  key={b.id}
                  branch={b}
                  canDelete={branches.length > 1}
                  onEdit={() => setEditId(b.id)}
                  onToggle={() => store.updateBranch(b.id, { enabled: !b.enabled })}
                  onDelete={() => {
                    if (branches.length <= 1) {
                      toast.error("At least one branch is required.");
                      return;
                    }
                    if (
                      !confirm(
                        `Delete branch "${b.name}"? Patients will be reassigned to the first remaining branch.`,
                      )
                    )
                      return;
                    store.removeBranch(b.id);
                    toast.success("Branch removed & patients reassigned");
                  }}
                />
              ),
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function BranchRow({
  branch,
  canDelete,
  onEdit,
  onToggle,
  onDelete,
}: {
  branch: Branch;
  canDelete: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="p-4 rounded-xl bg-surface border">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">{branch.name}</span>
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full ${branch.enabled ? "bg-emerald-500/10 text-emerald-700" : "bg-muted text-muted-foreground"}`}
            >
              {branch.enabled ? "Enabled" : "Disabled"}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{branch.address}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {branch.phone}
            {branch.license && ` · Reg. ${branch.license}`}
          </p>
        </div>
        <div className="flex gap-1 shrink-0">
          <Button size="sm" variant="outline" onClick={onToggle}>
            {branch.enabled ? "Disable" : "Enable"}
          </Button>
          <Button size="sm" variant="ghost" onClick={onEdit} aria-label="Edit">
            <Pencil className="size-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onDelete}
            disabled={!canDelete}
            aria-label="Delete"
          >
            <Trash2
              className={`size-4 ${canDelete ? "text-destructive" : "text-muted-foreground"}`}
            />
          </Button>
        </div>
      </div>
    </div>
  );
}

function BranchEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial: Omit<Branch, "id"> & Partial<Pick<Branch, "id">>;
  onSave: (b: Omit<Branch, "id">) => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState<Omit<Branch, "id">>({
    name: initial.name,
    address: initial.address,
    mapUrl: initial.mapUrl,
    phone: initial.phone,
    emailId: initial.emailId || "",
    license: initial.license,
    enabled: initial.enabled,
    hours: initial.hours ?? { ...EMPTY_HOURS },
  });
  const hours = f.hours ?? EMPTY_HOURS;

  function setHour(k: keyof BranchHours, v: string) {
    setF({ ...f, hours: { ...hours, [k]: v } });
  }

  function save() {
    if (!f.name.trim()) {
      toast.error("Branch name is required");
      return;
    }
    // Blank hour fields fall back to the standard clinic schedule.
    const h = f.hours ?? { ...EMPTY_HOURS };
    const filled = Object.fromEntries(
      (Object.keys(DEFAULT_HOURS) as Array<keyof BranchHours>).map((k) => [
        k,
        (h[k] || "").trim() || DEFAULT_HOURS[k],
      ]),
    ) as unknown as BranchHours;
    onSave({ ...f, hours: filled });
  }

  return (
    <div className="p-4 rounded-xl bg-background border border-brand/30">
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Label>Branch Name *</Label>
          <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </div>
        <div>
          <Label>Phone Number</Label>
          <Input
            value={f.phone}
            onChange={(e) => setF({ ...f, phone: e.target.value })}
            placeholder="+91 9900315254"
          />
        </div>
        <div className="sm:col-span-2">
          <Label>Address</Label>
          <Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
        </div>
        <div>
          <Label>Google Map Link</Label>
          <Input
            value={f.mapUrl}
            onChange={(e) => setF({ ...f, mapUrl: e.target.value })}
            placeholder="https://maps.app.goo.gl/..."
          />
        </div>
        <div>
          <Label>Email ID</Label>
          <Input
            type="email"
            value={f.emailId || ""}
            onChange={(e) => setF({ ...f, emailId: e.target.value })}
            placeholder="(falls back to Global Email)"
          />
        </div>
        <div className="sm:col-span-2">
          <Label>License / Registration Number</Label>
          <Input value={f.license} onChange={(e) => setF({ ...f, license: e.target.value })} />
        </div>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            checked={f.enabled}
            onChange={(e) => setF({ ...f, enabled: e.target.checked })}
          />
          Visible on public site
        </label>
      </div>
      <div className="mt-4">
        <Label className="text-sm font-semibold">Clinic Hours</Label>
        <div className="mt-2 grid sm:grid-cols-2 gap-2">
          {DAYS.map((d) => (
            <div key={d.k} className="grid grid-cols-[60px_1fr] gap-2 items-center">
              <span className="text-xs font-medium text-muted-foreground">{d.label}</span>
              <Input
                value={hours[d.k]}
                onChange={(e) => setHour(d.k, e.target.value)}
                placeholder="9:00 AM – 1:00 PM"
              />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={onCancel}>
          <X className="size-4" /> Cancel
        </Button>
        <Button size="sm" className="brand-gradient text-white border-0" onClick={save}>
          <Check className="size-4" /> Save
        </Button>
      </div>
    </div>
  );
}

function SpecialitiesManager() {
  const items = useStore((s) => s.settings.specialities);
  const [editId, setEditId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <div className="mt-6 p-6 rounded-2xl bg-card border">
      <div className="flex items-start gap-3">
        <div className="size-10 rounded-lg brand-gradient grid place-items-center text-white shrink-0">
          <Globe className="size-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h2 className="font-semibold">Specialities</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Manage the speciality cards on Home + Specialities pages.
              </p>
            </div>
            <Button onClick={() => setAdding(true)} className="brand-gradient text-white border-0">
              <Plus className="size-4" /> Add
            </Button>
          </div>
          <div className="mt-5 space-y-2">
            {adding && (
              <SpecialityEditor
                initial={{ icon: "Activity", title: "", desc: "" }}
                onCancel={() => setAdding(false)}
                onSave={(v) => {
                  store.addSpeciality(v);
                  setAdding(false);
                  toast.success("Speciality added");
                }}
              />
            )}
            {items.map((it) =>
              editId === it.id ? (
                <SpecialityEditor
                  key={it.id}
                  initial={it}
                  onCancel={() => setEditId(null)}
                  onSave={(v) => {
                    store.updateSpeciality(it.id, v);
                    setEditId(null);
                    toast.success("Updated");
                  }}
                />
              ) : (
                <div
                  key={it.id}
                  className="p-3 rounded-xl bg-surface border flex items-start justify-between gap-3 flex-wrap"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm">{it.title}</div>
                    <div className="text-xs text-muted-foreground line-clamp-2">{it.desc}</div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label="Edit"
                      onClick={() => setEditId(it.id)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label="Delete"
                      onClick={() => {
                        if (confirm(`Delete "${it.title}"?`)) {
                          store.removeSpeciality(it.id);
                          toast.success("Removed");
                        }
                      }}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ),
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SpecialityEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial: Omit<SpecialityItem, "id">;
  onSave: (v: Omit<SpecialityItem, "id">) => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState(initial);
  return (
    <div className="p-4 rounded-xl bg-background border border-brand/30 space-y-3">
      <div className="grid sm:grid-cols-3 gap-3">
        <div>
          <Label>Icon</Label>
          <select
            className="w-full h-9 px-3 rounded-md border bg-background"
            value={f.icon}
            onChange={(e) => setF({ ...f, icon: e.target.value })}
          >
            {ICON_OPTIONS.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <Label>Title</Label>
          <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        </div>
      </div>
      <div>
        <Label>Description</Label>
        <Textarea rows={2} value={f.desc} onChange={(e) => setF({ ...f, desc: e.target.value })} />
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={onCancel}>
          <X className="size-4" /> Cancel
        </Button>
        <Button size="sm" className="brand-gradient text-white border-0" onClick={() => onSave(f)}>
          <Check className="size-4" /> Save
        </Button>
      </div>
    </div>
  );
}

function CliniciansManager() {
  const enabled = useStore((s) => s.settings.cliniciansEnabled);
  const items = useStore((s) => s.settings.clinicians);
  const [editId, setEditId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <div className="mt-6 p-4 sm:p-6 rounded-2xl bg-card border overflow-hidden">
      <div className="flex flex-col sm:flex-row items-start gap-3">
        <div className="size-10 rounded-lg brand-gradient grid place-items-center text-white shrink-0">
          <Users className="size-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h2 className="font-semibold">Clinician Profiles</h2>
              <p className="text-sm text-muted-foreground mt-1">
                "Clinical Expertise" section on the public Home page.
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={enabled ? "outline" : "default"}
                onClick={() => {
                  store.setSettings({ cliniciansEnabled: !enabled });
                  toast.success(`Profiles ${!enabled ? "enabled" : "disabled"}`);
                }}
                className={enabled ? "" : "brand-gradient text-white border-0"}
              >
                {enabled ? "Disable Public" : "Enable Public"}
              </Button>
              <Button
                onClick={() => setAdding(true)}
                className="brand-gradient text-white border-0"
              >
                <Plus className="size-4" /> Add Clinician
              </Button>
            </div>
          </div>
          <div className="mt-5 space-y-2">
            {adding && (
              <ClinicianEditor
                initial={{ name: "", photo: "", qualification: "", experience: "", speciality: "" }}
                onCancel={() => setAdding(false)}
                onSave={(v) => {
                  store.addClinician(v);
                  setAdding(false);
                  toast.success("Clinician added");
                }}
              />
            )}
            {items.length === 0 && !adding && (
              <p className="text-sm text-muted-foreground italic">No clinician profiles yet.</p>
            )}
            {items.map((c) =>
              editId === c.id ? (
                <ClinicianEditor
                  key={c.id}
                  initial={c}
                  onCancel={() => setEditId(null)}
                  onSave={(v) => {
                    store.updateClinician(c.id, v);
                    setEditId(null);
                    toast.success("Updated");
                  }}
                />
              ) : (
                <div
                  key={c.id}
                  className="p-3 rounded-xl bg-surface border flex items-start justify-between gap-3 flex-wrap"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="size-10 rounded-full bg-brand/10 grid place-items-center overflow-hidden shrink-0">
                      {c.photo ? (
                        <img src={c.photo} alt={c.name} className="w-full h-full object-cover" />
                      ) : (
                        <Award className="size-5 text-brand" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate">{c.name || "(unnamed)"}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {[c.qualification, c.speciality].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label="Edit"
                      onClick={() => setEditId(c.id)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label="Delete"
                      onClick={() => {
                        if (confirm(`Remove ${c.name || "this profile"}?`)) {
                          store.removeClinician(c.id);
                          toast.success("Removed");
                        }
                      }}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ),
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ClinicianEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial: Omit<Clinician, "id">;
  onSave: (v: Omit<Clinician, "id">) => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState(initial);
  function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image exceeds 5 MB limit");
      return;
    }
    const r = new FileReader();
    r.onload = () => setF({ ...f, photo: String(r.result || "") });
    r.onerror = () => toast.error("Failed to read image");
    r.readAsDataURL(file);
  }

  return (
    <div className="w-full min-w-0 p-3 sm:p-4 rounded-xl bg-background border border-brand/30 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
        <div className="min-w-0">
          <Label>Name</Label>
          <Input
            value={f.name}
            onChange={(e) => setF({ ...f, name: e.target.value })}
            placeholder="Name"
          />
        </div>
        <div className="min-w-0">
          <Label>Photo (max 5 MB)</Label>
          <div className="flex items-center gap-3 mt-1 min-w-0">
            {f.photo ? (
              <div className="relative shrink-0">
                <img
                  src={f.photo}
                  alt="Clinician"
                  className="size-14 rounded-full object-cover ring-2 ring-brand/20"
                />
                <button
                  type="button"
                  onClick={() => setF({ ...f, photo: "" })}
                  aria-label="Remove photo"
                  className="absolute -top-1 -right-1 grid place-items-center size-5 rounded-full bg-destructive text-white shadow"
                >
                  <X className="size-3" />
                </button>
              </div>
            ) : null}
            <label
              className="flex-1 min-w-0 flex items-center justify-center gap-2 h-14 px-3 rounded-xl
                border-2 border-dashed border-brand/40 bg-accent/30 text-brand text-sm font-medium
                cursor-pointer select-none transition-colors hover:bg-accent/60 active:scale-[0.99]"
            >
              <Camera className="size-5 shrink-0" />
              <span className="truncate">{f.photo ? "Change photo" : "Tap to upload photo"}</span>
              <input type="file" accept="image/*" onChange={onPhoto} className="sr-only" />
            </label>
          </div>
        </div>
        <div>
          <Label>Qualification</Label>
          <Input
            value={f.qualification}
            onChange={(e) => setF({ ...f, qualification: e.target.value })}
            placeholder="BPT, MPT (Orthopaedics)"
          />
        </div>
        <div>
          <Label>Years of Experience</Label>
          <Input
            value={f.experience}
            onChange={(e) => setF({ ...f, experience: e.target.value })}
            placeholder="10+ years"
          />
        </div>
        <div className="sm:col-span-2">
          <Label>Speciality</Label>
          <Input
            value={f.speciality}
            onChange={(e) => setF({ ...f, speciality: e.target.value })}
            placeholder="Sports & Musculoskeletal Rehab"
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={onCancel}>
          <X className="size-4" /> Cancel
        </Button>
        <Button size="sm" className="brand-gradient text-white border-0" onClick={() => onSave(f)}>
          <Check className="size-4" /> Save
        </Button>
      </div>
    </div>
  );
}
