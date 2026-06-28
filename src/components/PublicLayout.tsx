import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Logo } from "@/components/Logo";
import { CLINIC, enabledBranches } from "@/lib/logo";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { ExternalLink, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/about", label: "About" },
  { to: "/specialities", label: "Specialities" },
  { to: "/contact", label: "Contact" },
  { to: "/book", label: "Book Visit" },
];

export function PublicLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const settings = useStore((s) => s.settings);
  const branches = enabledBranches(settings);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const signedIn = mounted && !!user;

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <header className="sticky top-0 z-40 bg-background/90 backdrop-blur border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center">
            <Logo size={40} />
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

      <main className="flex-1">
        {children}
      </main>

      <footer className="bg-foreground text-background mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 grid gap-8 md:grid-cols-4">
          <div className="md:col-span-2">
            <Logo size={48} textClassName="text-background" />
            <p className="mt-4 text-sm text-background/70 max-w-md">
              Expert care for everything from musculoskeletal conditions and sports injuries
              to post surgical recovery.
            </p>
            <p className="mt-3 text-xs text-background/60 italic">{CLINIC.tagline}</p>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-3">Visit Us</h4>
            <div className="space-y-3">
              {branches.map((b) => (
                <div key={b.id}>
                  <div className="text-sm font-medium text-background/90">{b.name}</div>
                  <p className="text-xs text-background/70 mt-0.5">{b.address}</p>
                  {b.mapUrl && (
                    <a href={b.mapUrl} target="_blank" rel="noreferrer"
                       className="inline-flex items-center gap-1 text-xs text-background/80 hover:text-background mt-1 underline-offset-2 hover:underline">
                      View on Google Maps <ExternalLink className="size-3" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-3">Contact</h4>
            <div className="space-y-1.5">
              {branches.map((b) => (
                <p key={b.id} className="text-sm text-background/70">
                  <span className="text-background/90">{b.name}:</span> {b.phone}
                </p>
              ))}
              <p className="text-sm text-background/70 break-all pt-1">{CLINIC.email}</p>
            </div>
          </div>
        </div>
        <div className="border-t border-background/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 text-xs text-background/50 text-center">
            © {new Date().getFullYear()} {CLINIC.name}. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
