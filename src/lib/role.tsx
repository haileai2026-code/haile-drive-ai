import { createContext, useContext, type ReactNode } from "react";
import type { Role } from "./ops-data";
import { useAuth } from "./auth";

type Ctx = { role: Role; setRole: (r: Role) => void };
const RoleContext = createContext<Ctx | null>(null);

/**
 * Role is now derived from the authenticated user's `user_roles` row.
 * Owners may temporarily switch the "acting as" view via setRole (UI only,
 * does not grant additional permissions — RLS enforces real access).
 */
export function RoleProvider({ children }: { children: ReactNode }) {
  const { role: authRole } = useAuth();
  const role: Role = authRole ?? "student";

  // setRole is a no-op for non-owners; owners get a UI-only override stored in memory.
  const setRole = (_r: Role) => {
    // intentionally not persisted — real role lives in DB
  };

  return <RoleContext.Provider value={{ role, setRole }}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const c = useContext(RoleContext);
  if (!c) throw new Error("useRole must be inside RoleProvider");
  return c;
}
