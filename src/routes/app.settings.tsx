import { createFileRoute } from "@tanstack/react-router";
import { store, useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Globe } from "lucide-react";

export const Route = createFileRoute("/app/settings")({
  component: Settings,
});

function Settings() {
  const { user, hasRole } = useAuth();
  const settings = useStore((s) => s.settings);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");

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
        <div className="mt-6 p-6 rounded-2xl bg-card border max-w-xl">
          <div className="flex items-start gap-3">
            <div className="size-10 rounded-lg brand-gradient grid place-items-center text-white shrink-0"><Globe className="size-5" /></div>
            <div className="flex-1">
              <h2 className="font-semibold">Public Website Controls</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Toggle clinic statistics (Patients Treated, Years of Practice, Recovery Rate, Specialised Programs) on the public home page.
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
      )}
    </div>
  );
}
