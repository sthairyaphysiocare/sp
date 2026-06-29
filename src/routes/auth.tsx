import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [{ title: "Staff Login — Sthairya Physiocare" }, { name: "robots", content: "noindex" }],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const usernameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) navigate({ to: "/app", replace: true });
  }, [user, navigate]);

  useEffect(() => { usernameRef.current?.focus(); }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const u = login(username, password);
    if (!u) { toast.error("Invalid credentials"); return; }
    toast.success(`Welcome, ${u.name}`);
    navigate({ to: "/app" });
  }

  return (
    <div className="min-h-screen grid place-items-center px-4 py-12 bg-surface">
      <Toaster />
      <div className="w-full max-w-md text-center">
        <div className="flex justify-center mb-6"><Logo size={56} /></div>
        <h2 className="text-2xl sm:text-3xl font-bold">Staff Sign In</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">
          Authorised personnel only. Sign in with your staff <strong>username</strong>.
        </p>

        <form onSubmit={submit} className="mt-8 space-y-4 text-left bg-card border rounded-2xl p-6 sm:p-8 soft-shadow">
          <div>
            <Label htmlFor="u">Username</Label>
            <Input
              id="u"
              ref={usernameRef}
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div>
            <Label htmlFor="p">Password</Label>
            <Input
              id="p"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" size="lg" className="w-full brand-gradient text-white border-0">Sign In</Button>
        </form>

        <Link to="/" className="block mt-6 text-sm text-brand hover:underline">← Back to website</Link>
      </div>
    </div>
  );
}
