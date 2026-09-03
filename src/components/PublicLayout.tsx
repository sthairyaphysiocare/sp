import { ContactFab } from "@/components/ContactFab";
import { DeveloperCredit } from "@/components/DeveloperCredit";
import { cn } from "@/lib/utils";
import { ENQUIRY_MESSAGE, ENQUIRY_SUBJECT, mailtoLink } from "@/lib/contactLinks";
import { BackToTop } from "@/components/BackToTop";
import { Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Logo } from "@/components/Logo";
import { CLINIC, enabledBranches } from "@/lib/logo";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import {
  BookOpen,
  ChevronRight,
  ExternalLink,
  Facebook,
  Instagram,
  Mail as MailIcon,
  Menu,
  Phone as PhoneIcon,
  X,
  Youtube,
} from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
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

  // Escape closes the mobile menu. Tapping away from it is handled by the
  // backdrop element rendered below, not by a document listener: a global
  // pointerdown listener races with the very tap that opens the menu, which is
  // what stopped the menu opening at all.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Which menu item was just tapped. Previously the panel closed on the same
  // tick as the tap, so nothing was ever seen; the destination simply appeared.
  // Holding the panel open briefly lets the highlight register, and the item
  // stays lit while the route loads, which matters most when a chunk still has
  // to be fetched. Navigation is untouched — the Link performs it on click
  // exactly as before, so this is purely additive feedback.
  const [pressedTo, setPressedTo] = useState<string | null>(null);
  const closeTimer = useRef<number | null>(null);

  const clearCloseTimer = () => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  useEffect(() => {
    if (!open) {
      setPressedTo(null);
      clearCloseTimer();
    }
  }, [open]);

  useEffect(() => clearCloseTimer, []);

  function handleMenuTap(to: string) {
    setPressedTo(to);
    clearCloseTimer();
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = null;
      setOpen(false);
    }, 260);
  }

  return (
    <div data-ui-enhance className="min-h-screen flex flex-col">
      {/* Tap-away layer for the mobile menu. Sits below the header's z-40 so the
          bar and the open panel stay interactive, and starts below the bar so
          the logo and close button are never covered. Rendered as a sibling of
          the header rather than a child because the header's backdrop-blur
          establishes a containing block for fixed positioning. */}
      {open && (
        <div
          className="menu-backdrop-in md:hidden fixed inset-x-0 bottom-0 top-16 z-30 bg-foreground/10"
          aria-hidden="true"
          onClick={() => setOpen(false)}
        />
      )}
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
          <div
            className={cn(
              "md:hidden border-t px-4 py-3 space-y-1",
              // Overlays the page instead of sitting in the flow. In the flow it
              // pushed all the content down on open and yanked it back up on
              // close, so a tap outside the menu landed on whatever had moved
              // into that spot rather than what was actually tapped. As an
              // overlay nothing reflows, so the tap both closes the menu and
              // reaches its intended target.
              "absolute top-full left-0 right-0",
              // Scrollable in case the menu ever outgrows the viewport.
              "max-h-[calc(100vh-4rem)] overflow-y-auto",
              // Ice-blue wash drawn from the same --surface / --accent tokens as
              // the rest of the site, so it reads as part of the theme rather
              // than a flat white sheet. Both tokens are theme-aware, so this
              // follows dark mode automatically.
              "bg-gradient-to-b from-surface to-accent soft-shadow",
              "menu-panel-in",
            )}
          >
            {NAV.map((n, i) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => handleMenuTap(n.to)}
                style={{ animationDelay: `${i * 35}ms` }}
                className={cn(
                  "menu-item menu-item-in flex items-center justify-between gap-2",
                  "px-3 py-3 rounded-md text-sm font-medium",
                  "transition-[background-color,color,transform] duration-150",
                  // Fires on touch-down, before navigation begins, so the press
                  // is acknowledged immediately. A solid brand fill rather than
                  // a tint: against the panel's ice-blue wash a light background
                  // is only a few shades different and barely registers.
                  "active:scale-[0.985] active:bg-brand active:text-white",
                  "hover:bg-card hover:text-brand",
                  // Held until the panel closes, so the chosen item stays obvious
                  // while the next route is still loading.
                  pressedTo === n.to && "bg-brand text-white soft-shadow",
                )}
                // Marks the page currently being viewed.
                activeProps={{ className: "bg-card/80 text-brand font-semibold" }}
                activeOptions={{ exact: n.to === "/" }}
              >
                <span>{n.label}</span>
                <ChevronRight
                  aria-hidden="true"
                  className={cn(
                    "size-4 shrink-0 transition-all duration-200",
                    pressedTo === n.to ? "translate-x-0.5 text-white opacity-100" : "opacity-30",
                  )}
                />
              </Link>
            ))}
            <Link
              to={signedIn ? "/app" : "/auth"}
              onClick={() => handleMenuTap(signedIn ? "/app" : "/auth")}
              style={{ animationDelay: `${NAV.length * 35}ms` }}
              className="menu-item menu-item-in block pt-1"
            >
              <Button className="w-full brand-gradient text-white border-0 transition-transform duration-150 active:scale-[0.985]">
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
                href={mailtoLink(globalEmail, ENQUIRY_SUBJECT, ENQUIRY_MESSAGE)}
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
          <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4 pb-24 flex flex-col sm:flex-row items-center justify-center sm:justify-between gap-2 text-xs text-background/50">
            <span>
              © {new Date().getFullYear()} {CLINIC.name}. All rights reserved.
            </span>
            <DeveloperCredit />
          </div>
        </div>
      </footer>
      <ContactFab />
      <BackToTop />
    </div>
  );
}
