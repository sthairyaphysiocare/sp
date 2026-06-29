import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/lib/auth";
import {
  LayoutDashboard, Users, CalendarClock, Settings, LogOut, UserCog, Menu, FileBarChart2,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/types";

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  roles: Role[];
}

const NAV: NavItem[] = [
  { to: "/app", label: "Dashboard", icon: <LayoutDashboard className="size-4" />, roles: ["admin", "therapist", "reception", "other"] },
  { to: "/app/patients", label: "Patients", icon: <Users className="size-4" />, roles: ["admin", "therapist", "reception", "other"] },
  { to: "/app/bookings", label: "Bookings", icon: <CalendarClock className="size-4" />, roles: ["admin", "therapist", "reception"] },
  { to: "/app/reports", label: "Reports", icon: <FileBarChart2 className="size-4" />, roles: ["admin", "therapist", "reception"] },
  { to: "/app/staff", label: "Staff", icon: <UserCog className="size-4" />, roles: ["admin"] },
  { to: "/app/settings", label: "Settings", icon: <Settings className="size-4" />, roles: ["admin", "therapist", "reception", "other"] },
];

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  if (!user) {
    if (typeof window !== "undefined") navigate({ to: "/auth", replace: true });
    return null;
  }

  const visible = NAV.filter((n) => n.roles.includes(user.role));

  const Sidebar = (
    <aside className="w-64 shrink-0 bg-card border-r flex flex-col">
      <div className="h-16 px-4 flex items-center border-b">
        <Link to="/app"><Logo size={36} /></Link>
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {visible.map((n) => {
          const active = pathname === n.to || (n.to !== "/app" && pathname.startsWith(n.to));
          return (
            <Link
              key={n.to}
              to={n.to}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-11",
                active ? "bg-brand text-white" : "text-foreground/70 hover:bg-accent",
              )}
            >
              {n.icon} {n.label}
            </Link>
          );
        })}

        <div className="mt-2 pt-3 border-t">
          <div className="px-3 py-2">
            <div className="text-sm font-semibold truncate">{user.name}</div>
            <div className="text-xs text-muted-foreground truncate">@{user.email}</div>
            <div className="text-[11px] mt-0.5 text-muted-foreground capitalize">{user.role}</div>
          </div>
          <button
            onClick={() => { logout(); navigate({ to: "/" }); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 min-h-11"
          >
            <LogOut className="size-4" /> Secure Logout
          </button>
        </div>
      </nav>
    </aside>
  );

  return (
    <div className="min-h-screen flex bg-surface">
      <div className="hidden md:flex">{Sidebar}</div>
      {open && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative">{Sidebar}</div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden h-16 border-b bg-card px-4 flex items-center justify-between">
          <button onClick={() => setOpen(true)} className="h-11 w-11 grid place-items-center rounded-md hover:bg-accent" aria-label="Open menu">
            <Menu />
          </button>
          <Logo size={32} showText={false} />
          <div className="w-11" />
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
