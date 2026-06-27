import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Logo } from "@/components/Logo";
import { CLINIC } from "@/lib/logo";
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
            <Link to={user ? "/app" : "/auth"} className="ml-2">
              <Button className="brand-gradient text-white border-0">
                {user ? "Open Dashboard" : "Staff Login"}
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
            <Link to={user ? "/app" : "/auth"} onClick={() => setOpen(false)} className="block">
              <Button className="w-full brand-gradient text-white border-0">
                {user ? "Open Dashboard" : "Staff Login"}
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
              Sthairya Physiocare — expert musculoskeletal rehabilitation, sports
              medicine, and post-operative recovery in Puttur.
            </p>
            <p className="mt-3 text-xs text-background/60 italic">{CLINIC.tagline}</p>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-3">Visit Us</h4>
            <p className="text-sm text-background/70">{CLINIC.address}</p>
            <p className="text-xs text-background/50 mt-2">Map: {CLINIC.mapRef}</p>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-3">Contact</h4>
            <p className="text-sm text-background/70">Phone: {CLINIC.phone}</p>
            <p className="text-sm text-background/70 break-all">{CLINIC.email}</p>
            <p className="text-sm text-background/70 mt-2">{CLINIC.domain}</p>
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
