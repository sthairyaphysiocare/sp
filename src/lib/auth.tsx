import { createContext, useContext, useMemo, type ReactNode } from "react";
import { store, useStore } from "./store";
import type { Role, User } from "./types";

interface AuthCtx {
  user: User | null;
  login: (email: string, password: string) => User | null;
  logout: () => void;
  hasRole: (...r: Role[]) => boolean;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const userId = useStore((s) => s.session.userId);
  const users = useStore((s) => s.users);
  const user = useMemo(() => users.find((u) => u.id === userId) ?? null, [users, userId]);

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
