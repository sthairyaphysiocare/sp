import { createFileRoute } from "@tanstack/react-router";
import { store, useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Trash2, Key } from "lucide-react";
import type { Role } from "@/lib/types";

export const Route = createFileRoute("/app/staff")({
  component: Staff,
});

function Staff() {
  const { hasRole, user } = useAuth();
  const users = useStore((s) => s.users);
  const [form, setForm] = useState({ name: "", email: "", role: "therapist" as Role, password: "" });

  if (!hasRole("admin")) {
    return <div className="text-center py-20 text-muted-foreground">Admins only.</div>;
  }

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) { toast.error("All fields required"); return; }
    store.addUser(form);
    setForm({ name: "", email: "", role: "therapist", password: "" });
    toast.success("Staff member added");
  }

  function resetPw(id: string) {
    const pw = prompt("Set new password:");
    if (pw) { store.resetPassword(id, pw); toast.success("Password reset"); }
  }

  function remove(id: string) {
    if (id === user?.id) { toast.error("Cannot remove yourself"); return; }
    if (confirm("Remove this staff member?")) { store.removeUser(id); toast.success("Removed"); }
  }

  return (
    <div>
      <Toaster />
      <h1 className="text-2xl sm:text-3xl font-bold">Staff & Roles</h1>
      <p className="text-sm text-muted-foreground mt-1">Manage logins and reset passwords.</p>

      <form onSubmit={add} className="mt-6 p-6 rounded-2xl bg-card border grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div>
          <Label>Role</Label>
          <select className="w-full h-9 px-3 rounded-md border bg-background" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
            <option value="admin">Admin</option><option value="therapist">Therapist</option><option value="reception">Reception</option>
          </select>
        </div>
        <div><Label>Password</Label><Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
        <div className="flex items-end"><Button type="submit" className="w-full brand-gradient text-white border-0">Add</Button></div>
      </form>

      <div className="mt-6 rounded-2xl bg-card border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-left px-4 py-3">Role</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="px-4 py-3 font-medium">{u.name}</td>
                <td className="px-4 py-3">{u.email}</td>
                <td className="px-4 py-3 capitalize">{u.role}</td>
                <td className="px-4 py-3 text-right">
                  <Button size="sm" variant="ghost" onClick={() => resetPw(u.id)}><Key className="size-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(u.id)} disabled={u.id === user?.id}><Trash2 className="size-4 text-destructive" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
