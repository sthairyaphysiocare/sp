import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { useStore, store } from "@/lib/store";
import { generateOtp, sendOtpEmail } from "@/lib/emailOtp";
import { saveOtp, loadOtp, clearOtp, OTP_TTL_MINUTES } from "@/lib/session";
import { CLINIC } from "@/lib/logo";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [{ title: "Staff Login — Sthairya Physiocare" }, { name: "robots", content: "noindex" }],
  }),
  component: AuthPage,
});

type Mode = "signin" | "forgot-email" | "forgot-otp" | "forgot-reset";

function AuthPage() {
  const { login, user } = useAuth();
  const users = useStore((s) => s.users);
  const settings = useStore((s) => s.settings);

  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [otp, setOtp] = useState("");
  const [otpUserId, setOtpUserId] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [busy, setBusy] = useState(false);
  const [lockError, setLockError] = useState("");
  const usernameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) navigate({ to: "/app", replace: true });
  }, [user, navigate]);
  useEffect(() => {
    usernameRef.current?.focus();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      setLockError("");
      const res = await login(username, password);
      if (res.ok) {
        toast.success(`Welcome, ${res.user.name}`);
        navigate({ to: "/app" });
        return;
      }
      if (res.reason === "account-locked") {
        setLockError("Account locked due to multiple failed attempts. Contact Admin.");
        toast.error("Account locked due to multiple failed attempts. Contact Admin.");
      } else if (res.reason === "locked") {
        const mins = Math.max(1, Math.ceil((res.remainingMs ?? 0) / 60000));
        toast.error(`Too many attempts. Try again in ${mins} min.`);
      } else if (res.reason === "bad-credentials") {
        const left = res.failsLeft ?? 0;
        toast.error(
          left > 0
            ? `Invalid credentials. ${left} attempt${left === 1 ? "" : "s"} left.`
            : "Invalid credentials.",
        );
      } else {
        toast.error("Sign-in failed. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    const target = forgotEmail.trim().toLowerCase();
    const found = users.find((u) => (u.emailId || "").trim().toLowerCase() === target);
    if (!found) {
      toast.error("No staff account found for that email");
      return;
    }
    const code = generateOtp();
    setBusy(true);
    const t = toast.loading("Sending OTP...");
    try {
      await sendOtpEmail({
        toEmail: target,
        toName: found.name,
        otp: code,
        fromEmail: settings.globalEmail || CLINIC.email,
      });
      saveOtp(found.id, code, target);
      setOtp(code);
      setOtpUserId(found.id);
      setMode("forgot-otp");
      toast.success(`OTP sent to ${target}. Expires in ${OTP_TTL_MINUTES} minutes.`, { id: t });
    } catch (err) {
      console.error(err);
      toast.error("Couldn't send OTP. Check email configuration.", { id: t });
    } finally {
      setBusy(false);
    }
  }

  function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    const stored = loadOtp();
    if (!stored || stored.userId !== otpUserId) {
      toast.error("OTP expired. Please request a new one.");
      setMode("forgot-email");
      return;
    }
    if (otpInput.trim() !== stored.code) {
      toast.error("Incorrect OTP");
      return;
    }
    setMode("forgot-reset");
  }

  function resetPwd(e: React.FormEvent) {
    e.preventDefault();
    if (newPwd.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (newPwd !== confirmPwd) {
      toast.error("Passwords don't match");
      return;
    }
    store.changePassword(otpUserId, newPwd);
    void store.unlockUser(otpUserId); // OTP reset proves ownership; clear any lockout
    clearOtp();
    setLockError("");
    toast.success("Password updated. Please sign in.");
    setMode("signin");
    setOtp("");
    setOtpInput("");
    setNewPwd("");
    setConfirmPwd("");
    setForgotEmail("");
  }

  return (
    <div className="min-h-screen grid place-items-center px-4 py-12">
      <Toaster />
      <div className="w-full max-w-md text-center">
        <div className="flex justify-center mb-6">
          <Link
            to="/"
            aria-label="Go to Home page"
            className="transition-transform hover:scale-[1.02]"
          >
            <Logo size={96} />
          </Link>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold">
          {mode === "signin" ? "Staff Sign In" : "Reset Password"}
        </h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">
          {mode === "signin" ? (
            <>
              Authorised personnel only. Sign in with your staff <strong>username</strong>.
            </>
          ) : (
            "Use the email registered to your staff profile."
          )}
        </p>

        {mode === "signin" && (
          <form
            onSubmit={submit}
            className="mt-8 space-y-4 text-left bg-card border rounded-2xl p-6 sm:p-8 soft-shadow"
          >
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
            {lockError && (
              <p
                role="alert"
                className="text-sm font-medium text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2"
              >
                {lockError}
              </p>
            )}
            <Button
              type="submit"
              size="lg"
              disabled={busy}
              className="w-full brand-gradient text-white border-0"
            >
              {busy ? "Signing in..." : "Sign In"}
            </Button>
            <div className="text-center">
              <button
                type="button"
                onClick={() => setMode("forgot-email")}
                className="text-sm text-brand hover:underline"
              >
                Forgot password?
              </button>
            </div>
          </form>
        )}

        {mode === "forgot-email" && (
          <form
            onSubmit={sendOtp}
            className="mt-8 space-y-4 text-left bg-card border rounded-2xl p-6 sm:p-8 soft-shadow"
          >
            <div>
              <Label htmlFor="fe">Registered Email ID</Label>
              <Input
                id="fe"
                type="email"
                autoFocus
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                Sent from: {settings.globalEmail || CLINIC.email}
              </p>
            </div>
            <Button
              type="submit"
              size="lg"
              disabled={busy}
              className="w-full brand-gradient text-white border-0"
            >
              {busy ? "Sending OTP..." : "Send OTP"}
            </Button>
            <button
              type="button"
              onClick={() => setMode("signin")}
              className="block w-full text-sm text-muted-foreground hover:underline"
            >
              Back to sign in
            </button>
          </form>
        )}

        {mode === "forgot-otp" && (
          <form
            onSubmit={verifyOtp}
            className="mt-8 space-y-4 text-left bg-card border rounded-2xl p-6 sm:p-8 soft-shadow"
          >
            <div>
              <Label htmlFor="otp">6-Digit OTP</Label>
              <Input
                id="otp"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                autoFocus
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ""))}
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                Check your inbox at {forgotEmail}
              </p>
            </div>
            <Button type="submit" size="lg" className="w-full brand-gradient text-white border-0">
              Verify
            </Button>
            <button
              type="button"
              onClick={() => setMode("forgot-email")}
              className="block w-full text-sm text-muted-foreground hover:underline"
            >
              Use a different email
            </button>
          </form>
        )}

        {mode === "forgot-reset" && (
          <form
            onSubmit={resetPwd}
            className="mt-8 space-y-4 text-left bg-card border rounded-2xl p-6 sm:p-8 soft-shadow"
          >
            <div>
              <Label htmlFor="np">New Password</Label>
              <Input
                id="np"
                type="password"
                autoFocus
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="cp">Confirm New Password</Label>
              <Input
                id="cp"
                type="password"
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                required
              />
            </div>
            <Button type="submit" size="lg" className="w-full brand-gradient text-white border-0">
              Save Password
            </Button>
          </form>
        )}

        <Link to="/" className="block mt-6 text-sm text-brand hover:underline">
          ← Back to website
        </Link>
      </div>
    </div>
  );
}
