import { createFileRoute } from "@tanstack/react-router";
import { store } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/app/settings")({
  component: Settings,
});

function Settings() {
  const { user } = useAuth();
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

  return (
    <div>
      <Toaster />
      <h1 className="text-2xl sm:text-3xl font-bold">Settings</h1>

      <div className="mt-6 p-6 rounded-2xl bg-card border max-w-xl">
        <h2 className="font-semibold">Account</h2>
        <div className="mt-3 space-y-2 text-sm">
          <div><span className="text-muted-foreground">Name:</span> {user?.name}</div>
          <div><span className="text-muted-foreground">Email:</span> {user?.email}</div>
          <div><span className="text-muted-foreground">Role:</span> <span className="capitalize">{user?.role}</span></div>
        </div>
      </div>

      <form onSubmit={save} className="mt-6 p-6 rounded-2xl bg-card border max-w-xl space-y-4">
        <h2 className="font-semibold">Change Password</h2>
        <div><Label>New Password</Label><Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} /></div>
        <div><Label>Confirm Password</Label><Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></div>
        <Button type="submit" className="brand-gradient text-white border-0">Update Password</Button>
      </form>
    </div>
  );
}
