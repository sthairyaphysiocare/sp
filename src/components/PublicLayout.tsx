import { ContactFab } from "@/components/ContactFab";
import { BackToTop } from "@/components/BackToTop";
import { Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Logo } from "@/components/Logo";
import { CLINIC, enabledBranches } from "@/lib/logo";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import {
  BookOpen,
  ExternalLink,
  Facebook,
  Instagram,
  Mail as MailIcon,
  Menu,
  Phone as PhoneIcon,
  X,
  Youtube,
} from "lucide-react";
import { useEffect, useLayoutEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/about", label: "About" },
  { to: "/specialities", label: "Specialities" },
  { to: "/contact", label: "Contact" },
  { to: "/book", label: "Book Visit" },
];

/**
 * Loads the standalone visual-enhancement layer (public/ui-enhancements.css
 * + .js) exactly once per browser session, regardless of how many times
 * PublicLayout mounts across client-side navigations. The script exposes
 * window.UIEnhance.init(), which IS safe (and expected) to call again on
 * every mount — it re-scans the freshly rendered page without leaking
 * duplicate global listeners (see the script's own guards).
 */
let uiEnhanceReady: Promise<void> | null = null;
function ensureUiEnhanceAssets(): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  if (!document.getElementById("ui-enhancements-css")) {
    const link = document.createElement("link");
    link.id = "ui-enhancements-css";
    link.rel = "stylesheet";
    link.href = "/ui-enhancements.css";
    document.head.appendChild(link);
  }
  if (!uiEnhanceReady) {
    uiEnhanceReady = new Promise((resolve) => {
      const existing = document.getElementById("ui-enhancements-js");
      if (existing) {
        if ((window as unknown as { UIEnhance?: unknown }).UIEnhance) resolve();
        else existing.addEventListener("load", () => resolve());
        return;
      }
      const script = document.createElement("script");
      script.id = "ui-enhancements-js";
      script.src = "/ui-enhancements.js";
      script.defer = true;
      script.onload = () => resolve();
      document.body.appendChild(script);
    });
  }
  return uiEnhanceReady;
}

export function PublicLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  // ---------------------------------------------------------------------
  // STRICT ROUTING SECURITY: the public site and the staff dashboard are
  // isolated zones. If this layout ever mounts while a staff session token
  // is present in sessionStorage — which normally only happens via the
  // browser's Back button after being in /app — treat it as an escape from
  // the secure zone: purge the token, reset auth state, and force the user
  // to the login screen with `replace: true` so Forward can't re-enter.
  // useLayoutEffect runs before paint to minimize any stale-UI flash.
  useLayoutEffect(() => {
    let cancelled = false;
    import("@/lib/session").then(({ loadSession }) => {
      if (cancelled) return;
      if (loadSession()) {
        logout();
        navigate({ to: "/auth", replace: true });
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Standalone visual-enhancement layer (additive CSS + vanilla JS,
  // public pages only — see public/ui-enhancements.{css,js}).
  useEffect(() => {
    let cancelled = false;
    ensureUiEnhanceAssets().then(() => {
      if (!cancelled) (window as unknown as { UIEnhance?: { init: () => void } }).UIEnhance?.init();
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const settings = useStore((s) => s.settings);
  const branches = enabledBranches(settings);
  const globalEmail = settings.globalEmail || CLINIC.email;
  // Social icons render ONLY when a URL exists AND the platform is enabled.
  const normalizeUrl = (u: string) => (/^https?:\/\//i.test(u) ? u : `https://${u}`);
  const soc = settings.socials;
  const socialLinks = soc
    ? (
        [
          {
            key: "youtube",
            label: "YouTube",
            link: soc.youtube,
            icon: <Youtube className="size-4" />,
          },
          {
            key: "instagram",
            label: "Instagram",
            link: soc.instagram,
            icon: <Instagram className="size-4" />,
          },
          {
            key: "facebook",
            label: "Facebook",
            link: soc.facebook,
            icon: <Facebook className="size-4" />,
          },
          { key: "blog", label: "Blog", link: soc.blog, icon: <BookOpen className="size-4" /> },
        ] as const
      )
        .filter((x) => x.link.enabled && x.link.url.trim() !== "")
        .map((x) => ({
          key: x.key,
          label: x.label,
          url: normalizeUrl(x.link.url.trim()),
          icon: x.icon,
        }))
    : [];
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // "Open Dashboard" renders ONLY when BOTH hold: the Auth Context has a
  // verified user AND a live (unexpired) session token exists in
  // sessionStorage for that same user. Anything else renders "Staff Login".
  const [liveSession, setLiveSession] = useState(false);
  useEffect(() => {
    if (!mounted || !user) {
      setLiveSession(false);
      return;
    }
    let cancelled = false;
    const check = () =>
      import("@/lib/session").then(({ loadSession }) => {
        const sess = loadSession();
        if (!cancelled) setLiveSession(!!sess && sess.userId === user.id);
      });
    void check();
    const t = setInterval(() => void check(), 15_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [mounted, user]);
  const signedIn = mounted && !!user && liveSession;

  return (
    <div data-ui-enhance className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-background/90 backdrop-blur border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center">
            <Logo size={52} />
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className="px-3 py-2 text-sm font-medium text-foreground/80 hover:text-brand transition-colors rounded-md"
                activeProps={{ className: "text-brand bg-accent" }}
                activeOptions={{ exact: n.to === "/" }}
              >
                {n.label}
              </Link>
            ))}
            <Link to={signedIn ? "/app" : "/auth"} className="ml-2">
              <Button className="brand-gradient text-white border-0">
                {signedIn ? "Open Dashboard" : "Staff Login"}
              </Button>
            </Link>
          </nav>
          <button
            className="md:hidden h-11 w-11 grid place-items-center rounded-md hover:bg-accent"
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
        {open && (
          <div className="md:hidden border-t bg-background px-4 py-3 space-y-1">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className="block px-3 py-3 rounded-md hover:bg-accent text-sm font-medium"
              >
                {n.label}
              </Link>
            ))}
            <Link to={signedIn ? "/app" : "/auth"} onClick={() => setOpen(false)} className="block">
              <Button className="w-full brand-gradient text-white border-0">
                {signedIn ? "Open Dashboard" : "Staff Login"}
              </Button>
            </Link>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="bg-foreground text-background mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 grid gap-8 md:grid-cols-4">
          <div className="md:col-span-2">
            <Logo size={60} textClassName="text-background" />
            <p className="mt-4 text-sm text-background/70 max-w-md">
              Expert care for everything from musculoskeletal conditions and sports injuries to post
              surgical recovery.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-3">Visit Us</h4>
            <div className="space-y-3">
              {branches.map((b) => (
                <div key={b.id}>
                  <div className="text-sm font-medium text-background/90">{b.name}</div>
                  <p className="text-xs text-background/70 mt-0.5">{b.address}</p>
                  {b.mapUrl && (
                    <a
                      href={b.mapUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-background/80 hover:text-background mt-1 underline-offset-2 hover:underline"
                    >
                      View on Google Maps <ExternalLink className="size-3" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-3">Contact</h4>
            <div className="space-y-2">
              {branches.map((b) =>
                b.phone ? (
                  <a
                    key={b.id}
                    href={`tel:${b.phone.replace(/\s/g, "")}`}
                    className="flex items-center gap-2 text-sm text-background/70 hover:text-background transition-colors"
                  >
                    <PhoneIcon className="size-3.5 shrink-0 text-background/90" />
                    <span>
                      <span className="text-background/90">{b.name}:</span> {b.phone}
                    </span>
                  </a>
                ) : null,
              )}
              <a
                href={`mailto:${globalEmail}`}
                className="flex items-center gap-2 text-sm text-background/70 hover:text-background transition-colors break-all pt-1"
              >
                <MailIcon className="size-3.5 shrink-0 text-background/90" />
                <span className="break-all">{globalEmail}</span>
              </a>
              {socialLinks.length > 0 && (
                <div className="flex items-center gap-3 pt-3">
                  {socialLinks.map((sc) => (
                    <a
                      key={sc.key}
                      href={sc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={sc.label}
                      title={sc.label}
                      className="grid place-items-center size-9 rounded-full bg-background/10 text-background/80 hover:bg-background/20 hover:text-background transition-colors"
                    >
                      {sc.icon}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="border-t border-background/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 text-xs text-background/50 text-center">
            © {new Date().getFullYear()} {CLINIC.name}. All rights reserved.
          </div>
        </div>
      </footer>
      <ContactFab />
      <BackToTop />
    </div>
  );
}
