import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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

  useEffect(() => {
    if (user) navigate({ to: "/app", replace: true });
  }, [user, navigate]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const u = login(username, password);
    if (!u) { toast.error("Invalid credentials"); return; }
    toast.success(`Welcome, ${u.name}`);
    navigate({ to: "/app" });
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-surface">
      <Toaster />
      <div className="hidden lg:flex flex-col justify-between p-12 brand-gradient text-white">
        <Logo size={44} textClassName="text-white" />
        <div>
          <h1 className="text-4xl font-bold leading-tight">Clinical Workspace</h1>
          <p className="mt-3 text-white/85 max-w-md">
            Secure access to patient records, visit logs, recovery analytics, and prescription tools.
          </p>
        </div>
        <p className="text-xs text-white/60">© {new Date().getFullYear()} Sthairya Physiocare</p>
      </div>
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8"><Logo size={44} /></div>
          <h2 className="text-2xl font-bold">Staff Sign In</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Authorised personnel only. Sign in with your staff <strong>username</strong>.
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="u">Username</Label>
              <Input
                id="u"
                type="text"
                autoComplete="username"
                placeholder="your.username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="p">Password</Label>
              <Input id="p" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" size="lg" className="w-full brand-gradient text-white border-0">Sign In</Button>
          </form>

          <Link to="/" className="block mt-6 text-sm text-brand hover:underline text-center">← Back to website</Link>
        </div>
      </div>
    </div>
  );
}
