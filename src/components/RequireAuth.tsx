import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth, roleHomePath } from "@/lib/auth";
import type { Role } from "@/lib/ops-data";

export function RequireAuth({
  children,
  roles,
}: {
  children: ReactNode;
  roles?: Role[];
}) {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    if (roles && role && !roles.includes(role)) {
      navigate({ to: roleHomePath(role) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, role, loading, roles?.join("|"), navigate]);

  if (loading || !user) {
    return (
      <div className="grid min-h-screen place-items-center bg-night text-muted-foreground">
        <div className="animate-pulse text-sm">Loading…</div>
      </div>
    );
  }
  if (roles && role && !roles.includes(role)) {
    return (
      <div className="grid min-h-screen place-items-center bg-night text-muted-foreground">
        <div className="text-sm">Redirecting…</div>
      </div>
    );
  }
  return <>{children}</>;
}
