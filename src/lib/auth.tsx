import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import { store, useStore } from "./store";
import type { Role, User } from "./types";
import type { LoginResult } from "./store";
import { touchSession } from "./session";

interface AuthCtx {
  user: User | null;
  login: (username: string, password: string) => Promise<LoginResult>;
  logout: () => void;
  hasRole: (...r: Role[]) => boolean;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const userId = useStore((s) => s.session.userId);
  const users = useStore((s) => s.users);
  const user = useMemo(() => users.find((u) => u.id === userId) ?? null, [users, userId]);

  // Idle-session touch: any user interaction extends session expiry.
  const bound = useRef(false);
  useEffect(() => {
    if (bound.current || typeof window === "undefined") return;
    bound.current = true;
    const handler = () => touchSession();
    window.addEventListener("click", handler, { passive: true });
    window.addEventListener("keydown", handler, { passive: true });
    return () => {
      window.removeEventListener("click", handler);
      window.removeEventListener("keydown", handler);
    };
  }, []);

  const value: AuthCtx = {
    user,
    login: (e, p) => store.login(e, p),
    logout: () => store.logout(),
    hasRole: (...r) => !!user && r.includes(user.role),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("AuthProvider missing");
  return v;
}
