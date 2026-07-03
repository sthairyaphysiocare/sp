import { createFileRoute } from "@tanstack/react-router";
import { store, useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Trash2, Key, Pencil, X, Check, Lock, Unlock } from "lucide-react";
import type { Role, User } from "@/lib/types";

export const Route = createFileRoute("/app/staff")({
  component: Staff,
});

function Staff() {
  const { hasRole, user } = useAuth();
  const users = useStore((s) => s.users);
  const [form, setForm] = useState({
    name: "",
    username: "",
    role: "therapist" as Role,
    password: "",
    emailId: "",
  });
  const [editing, setEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; username: string; emailId: string }>({
    name: "",
    username: "",
    emailId: "",
  });

  // Locked accounts are fetched fresh from the database on mount (and after
  // every unlock), so locks that happened after this page hydrated still
  // appear. Store state is merged in as a fallback.
  const [serverLocked, setServerLocked] = useState<
    Array<{ id: string; email: string; name: string; role: string }>
  >([]);
  const refreshLocked = useCallback(async () => {
    try {
      const { listLockedUsers } = await import("@/lib/db.functions");
      setServerLocked(await listLockedUsers());
    } catch (err) {
      console.error("Couldn't refresh locked accounts:", err);
    }
  }, []);
  useEffect(() => {
    void refreshLocked();
  }, [refreshLocked]);

  const lockedUsers = (() => {
    const byId = new Map<string, { id: string; email: string; name: string; role: string }>();
    for (const u of users) {
      if (u.locked && u.role !== "admin")
        byId.set(u.id, { id: u.id, email: u.email, name: u.name, role: u.role });
    }
    for (const u of serverLocked) byId.set(u.id, u);
    return [...byId.values()];
  })();

  if (!hasRole("admin")) {
    return <div className="text-center py-20 text-muted-foreground">Admins only.</div>;
  }

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.username || !form.password) {
      toast.error("All fields required");
      return;
    }
    if (users.some((u) => u.email.toLowerCase() === form.username.toLowerCase())) {
      toast.error("Username already exists");
      return;
    }
    store.addUser({
      name: form.name,
      email: form.username,
      role: form.role,
      password: form.password,
      emailId: form.emailId.trim(),
    });
    setForm({ name: "", username: "", role: "therapist", password: "", emailId: "" });
    toast.success("Staff member added");
  }

  function resetPw(id: string) {
    const pw = prompt("Set new password:");
    if (pw) {
      store.resetPassword(id, pw);
      toast.success("Password reset");
    }
  }

  function remove(id: string) {
    if (id === user?.id) {
      toast.error("Cannot remove yourself");
      return;
    }
    if (confirm("Remove this staff member?")) {
      store.removeUser(id);
      toast.success("Removed");
    }
  }

  async function unlock(u: { id: string; name: string }) {
    const ok = await store.unlockUser(u.id);
    if (ok) toast.success(`${u.name}'s account unlocked`);
    else toast.error("Couldn't unlock — check connection and try again");
    void refreshLocked();
  }

  function startEdit(u: User) {
    setEditing(u.id);
    setEditForm({ name: u.name, username: u.email, emailId: u.emailId || "" });
  }

  function saveEdit(id: string) {
    if (!editForm.name.trim() || !editForm.username.trim()) {
      toast.error("Name and Username required");
      return;
    }
    if (
      users.some((u) => u.id !== id && u.email.toLowerCase() === editForm.username.toLowerCase())
    ) {
      toast.error("Username already in use");
      return;
    }
    store.updateUser(id, {
      name: editForm.name.trim(),
      email: editForm.username.trim(),
      emailId: editForm.emailId.trim(),
    });
    setEditing(null);
    toast.success("Staff updated");
  }

  return (
    <div>
      <Toaster />
      <h1 className="text-2xl sm:text-3xl font-bold">Staff & Roles</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Manage staff usernames, roles and passwords.
      </p>

      <form
        onSubmit={add}
        className="mt-6 p-6 rounded-2xl bg-card border grid sm:grid-cols-2 lg:grid-cols-6 gap-3"
      >
        <div>
          <Label>Name</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <Label>Username</Label>
          <Input
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            placeholder="e.g. dr.plinija"
          />
        </div>
        <div>
          <Label>Email ID</Label>
          <Input
            type="email"
            value={form.emailId}
            onChange={(e) => setForm({ ...form, emailId: e.target.value })}
            placeholder="for OTP & notices"
          />
        </div>
        <div>
          <Label>Role</Label>
          <select
            className="w-full h-9 px-3 rounded-md border bg-background"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
          >
            <option value="admin">Admin</option>
            <option value="therapist">Therapist</option>
            <option value="reception">Reception</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <Label>Password</Label>
          <Input
            type="text"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </div>
        <div className="flex items-end">
          <Button type="submit" className="w-full brand-gradient text-white border-0">
            Add
          </Button>
        </div>
      </form>

      {
        <div className="mt-6 p-6 rounded-2xl bg-destructive/5 border border-destructive/20">
          <h2 className="text-sm font-semibold flex items-center gap-2 text-destructive">
            <Lock className="size-4" /> Locked Accounts
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            These staff accounts were locked after 3 consecutive failed sign-in attempts. Unlock to
            restore their access.
          </p>
          <div className="mt-4 space-y-2">
            {lockedUsers.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between gap-3 p-3 rounded-lg bg-card border"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{u.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    @{u.email} · <span className="capitalize">{u.role}</span>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => unlock(u)}
                  className="brand-gradient text-white border-0 shrink-0"
                >
                  <Unlock className="size-4" /> Unlock
                </Button>
              </div>
            ))}
            {lockedUsers.length === 0 && (
              <p className="text-sm text-muted-foreground p-3 rounded-lg bg-card border">
                No accounts are currently locked.
              </p>
            )}
          </div>
        </div>
      }

      <div className="mt-6 rounded-2xl bg-card border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Username</th>
              <th className="text-left px-4 py-3">Email ID</th>
              <th className="text-left px-4 py-3">Role</th>
              <th className="text-right px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isEditing = editing === u.id;
              return (
                <tr key={u.id} className="border-t">
                  <td className="px-4 py-3 font-medium">
                    {isEditing ? (
                      <Input
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      />
                    ) : (
                      <span className="inline-flex items-center gap-1.5">
                        {u.name}
                        {u.locked && u.role !== "admin" && (
                          <Lock className="size-3.5 text-destructive" aria-label="Locked" />
                        )}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <Input
                        value={editForm.username}
                        onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                      />
                    ) : (
                      u.email
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {isEditing ? (
                      <Input
                        type="email"
                        value={editForm.emailId}
                        onChange={(e) => setEditForm({ ...editForm, emailId: e.target.value })}
                      />
                    ) : (
                      u.emailId || <span className="text-muted-foreground italic">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 capitalize">{u.role}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {isEditing ? (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => saveEdit(u.id)}
                          aria-label="Save"
                        >
                          <Check className="size-4 text-emerald-600" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditing(null)}
                          aria-label="Cancel"
                        >
                          <X className="size-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => startEdit(u)}
                          aria-label="Edit"
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => resetPw(u.id)}
                          aria-label="Reset password"
                        >
                          <Key className="size-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => remove(u.id)}
                          disabled={u.id === user?.id}
                          aria-label="Remove"
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
