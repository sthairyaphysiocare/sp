import { createFileRoute } from "@tanstack/react-router";
import { store, useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Globe, MapPin, Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import type { Branch } from "@/lib/types";

export const Route = createFileRoute("/app/settings")({
  component: Settings,
});

function Settings() {
  const { user, hasRole } = useAuth();
  const settings = useStore((s) => s.settings);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [wa, setWa] = useState(settings.whatsappNumber || "");

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (pw.length < 4) { toast.error("Password too short"); return; }
    if (pw !== pw2) { toast.error("Passwords don't match"); return; }
    store.changePassword(user.id, pw);
    setPw(""); setPw2("");
    toast.success("Password updated");
  }

  function togglePublicStats() {
    store.setSettings({ publicStatsEnabled: !settings.publicStatsEnabled });
    toast.success(`Public statistics ${!settings.publicStatsEnabled ? "enabled" : "disabled"}`);
  }

  function saveWa() {
    const digits = wa.replace(/[^0-9]/g, "");
    if (digits.length < 10) { toast.error("Enter a valid number"); return; }
    store.setSettings({ whatsappNumber: digits });
    toast.success("WhatsApp Business number updated");
  }

  return (
    <div>
      <Toaster />
      <h1 className="text-2xl sm:text-3xl font-bold">Settings</h1>

      <div className="mt-6 p-6 rounded-2xl bg-card border max-w-xl">
        <h2 className="font-semibold">Account</h2>
        <div className="mt-3 space-y-2 text-sm">
          <div><span className="text-muted-foreground">Name:</span> {user?.name}</div>
          <div><span className="text-muted-foreground">Username:</span> {user?.email}</div>
          <div><span className="text-muted-foreground">Role:</span> <span className="capitalize">{user?.role}</span></div>
        </div>
      </div>

      <form onSubmit={save} className="mt-6 p-6 rounded-2xl bg-card border max-w-xl space-y-4">
        <h2 className="font-semibold">Change Password</h2>
        <div><Label>New Password</Label><Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} /></div>
        <div><Label>Confirm Password</Label><Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></div>
        <Button type="submit" className="brand-gradient text-white border-0">Update Password</Button>
      </form>

      {hasRole("admin") && (
        <>
          <div className="mt-6 p-6 rounded-2xl bg-card border max-w-xl">
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-lg bg-emerald-500 grid place-items-center text-white shrink-0"><WhatsAppIcon size={20} /></div>
              <div className="flex-1">
                <h2 className="font-semibold">Global Clinic WhatsApp Business Number</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Used for all inbound queries and outbound automated messages site-wide. Include country code (e.g. 91 for India).
                </p>
                <div className="mt-3 flex gap-2">
                  <Input value={wa} onChange={(e) => setWa(e.target.value)} placeholder="919900315254" />
                  <Button onClick={saveWa} className="brand-gradient text-white border-0">Save</Button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 p-6 rounded-2xl bg-card border max-w-xl">
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-lg brand-gradient grid place-items-center text-white shrink-0"><Globe className="size-5" /></div>
              <div className="flex-1">
                <h2 className="font-semibold">Public Website Controls</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Toggle clinic statistics on the public home page.
                </p>
                <div className="mt-4 flex items-center justify-between gap-4 p-3 rounded-lg bg-surface border">
                  <div>
                    <div className="font-medium text-sm">Show Public Statistics</div>
                    <div className="text-xs text-muted-foreground">
                      Currently <strong className={settings.publicStatsEnabled ? "text-emerald-600" : "text-orange-600"}>
                        {settings.publicStatsEnabled ? "Enabled" : "Disabled"}
                      </strong>
                    </div>
                  </div>
                  <Button
                    onClick={togglePublicStats}
                    className={settings.publicStatsEnabled ? "" : "brand-gradient text-white border-0"}
                    variant={settings.publicStatsEnabled ? "outline" : "default"}
                  >
                    {settings.publicStatsEnabled ? "Disable" : "Enable"}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <BranchManager />
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
        <div className="size-10 rounded-lg brand-gradient grid place-items-center text-white shrink-0"><MapPin className="size-5" /></div>
        <div className="flex-1">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h2 className="font-semibold">Clinic Locations &amp; Settings</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Add, edit or disable branches. Disabled branches are hidden from the public site.
              </p>
            </div>
            <Button onClick={() => setAdding(true)} className="brand-gradient text-white border-0">
              <Plus className="size-4" /> Add Branch
            </Button>
          </div>

          <div className="mt-5 space-y-3">
            {adding && (
              <BranchEditor
                initial={{ name: "", address: "", mapUrl: "", phone: "", license: "", enabled: true }}
                onCancel={() => setAdding(false)}
                onSave={(b) => { store.addBranch(b); setAdding(false); toast.success("Branch added"); }}
              />
            )}
            {branches.map((b) =>
              editId === b.id ? (
                <BranchEditor
                  key={b.id}
                  initial={b}
                  onCancel={() => setEditId(null)}
                  onSave={(patch) => { store.updateBranch(b.id, patch); setEditId(null); toast.success("Branch updated"); }}
                />
              ) : (
                <BranchRow
                  key={b.id}
                  branch={b}
                  canDelete={branches.length > 1}
                  onEdit={() => setEditId(b.id)}
                  onToggle={() => store.updateBranch(b.id, { enabled: !b.enabled })}
                  onDelete={() => {
                    if (!confirm(`Delete branch "${b.name}"?`)) return;
                    store.removeBranch(b.id);
                    toast.success("Branch removed");
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

function BranchRow({ branch, canDelete, onEdit, onToggle, onDelete }: {
  branch: Branch; canDelete: boolean; onEdit: () => void; onToggle: () => void; onDelete: () => void;
}) {
  return (
    <div className="p-4 rounded-xl bg-surface border">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">{branch.name}</span>
            <span className={`text-[11px] px-2 py-0.5 rounded-full ${branch.enabled ? "bg-emerald-500/10 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
              {branch.enabled ? "Enabled" : "Disabled"}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{branch.address}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {branch.phone}{branch.license && ` · Reg. ${branch.license}`}
          </p>
        </div>
        <div className="flex gap-1 shrink-0">
          <Button size="sm" variant="outline" onClick={onToggle}>{branch.enabled ? "Disable" : "Enable"}</Button>
          <Button size="sm" variant="ghost" onClick={onEdit}><Pencil className="size-4" /></Button>
          {canDelete && (
            <Button size="sm" variant="ghost" onClick={onDelete}>
              <Trash2 className="size-4 text-destructive" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function BranchEditor({ initial, onSave, onCancel }: {
  initial: Omit<Branch, "id"> & Partial<Pick<Branch, "id">>;
  onSave: (b: Omit<Branch, "id">) => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState<Omit<Branch, "id">>({
    name: initial.name, address: initial.address, mapUrl: initial.mapUrl,
    phone: initial.phone, license: initial.license, enabled: initial.enabled,
  });

  function save() {
    if (!f.name.trim()) { toast.error("Branch name is required"); return; }
    onSave(f);
  }

  return (
    <div className="p-4 rounded-xl bg-background border border-brand/30">
      <div className="grid sm:grid-cols-2 gap-3">
        <div><Label>Branch Name *</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div><Label>Phone Number</Label><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="+91 9900315254" /></div>
        <div className="sm:col-span-2"><Label>Address</Label><Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></div>
        <div><Label>Google Map Link</Label><Input value={f.mapUrl} onChange={(e) => setF({ ...f, mapUrl: e.target.value })} placeholder="https://maps.app.goo.gl/..." /></div>
        <div><Label>License / Registration Number</Label><Input value={f.license} onChange={(e) => setF({ ...f, license: e.target.value })} /></div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.enabled} onChange={(e) => setF({ ...f, enabled: e.target.checked })} />
          Visible on public site
        </label>
      </div>
      <div className="mt-3 flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={onCancel}><X className="size-4" /> Cancel</Button>
        <Button size="sm" className="brand-gradient text-white border-0" onClick={save}><Check className="size-4" /> Save</Button>
      </div>
    </div>
  );
}
