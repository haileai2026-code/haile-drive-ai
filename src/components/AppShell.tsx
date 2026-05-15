import { Link, useLocation } from "@tanstack/react-router";
import { LayoutDashboard, BookOpen, Bot, Trophy, Users, LogOut, Activity, type LucideIcon } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { LangSwitcher } from "./LangSwitcher";
import { RequireAuth } from "./RequireAuth";
import { LeadLockScreen } from "./LeadLockScreen";
import { useAuth, roleHomePath } from "@/lib/auth";
import type { ReactNode } from "react";
import type { Role } from "@/lib/ops-data";

type NavItem = { to: string; icon: LucideIcon; key?: "dashboard" | "lessons" | "aiTeacher" | "quiz" | "community"; label?: string };

const items: NavItem[] = [
  { to: "/dashboard", icon: LayoutDashboard, key: "dashboard" },
  { to: "/lessons", icon: BookOpen, key: "lessons" },
  { to: "/ai", icon: Bot, key: "aiTeacher" },
  { to: "/quiz", icon: Trophy, key: "quiz" },
  { to: "/diagnostics", icon: Activity, label: "BEQA" },
  { to: "/community", icon: Users, key: "community" },
];

export function AppShell({
  children,
  roles,
  requireAuth = true,
}: {
  children: ReactNode;
  roles?: Role[];
  requireAuth?: boolean;
}) {
  const { t } = useI18n();
  const loc = useLocation();

  const { signOut, role } = useAuth();
  const homePath = roleHomePath(role);

  const isLead = role === "lead";
  const allowedForLead = loc.pathname.startsWith("/profile");
  const lockContent = isLead && !allowedForLead;

  const shell = (
    <div className="min-h-screen bg-night pb-24">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-screen-md items-center justify-between px-4 py-3">
          <Link to={homePath} className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-gold to-amber-600 text-gold-foreground font-black shadow-[var(--shadow-gold)]">H</span>
            <span className="text-sm font-semibold tracking-tight">{t("appName")}</span>
          </Link>
          <div className="flex items-center gap-2">
            <LangSwitcher />
            <button onClick={signOut} className="grid h-11 w-11 place-items-center rounded-lg text-muted-foreground hover:bg-accent" title="Sign out" aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-screen-md px-4 py-6">{lockContent ? <LeadLockScreen /> : children}</main>

      {!isLead && (
        <nav className="fixed bottom-4 left-1/2 z-40 w-[calc(100%-2rem)] max-w-screen-md -translate-x-1/2 rounded-2xl border border-border/70 bg-card/90 p-2 shadow-[var(--shadow-elev)] backdrop-blur-xl">
          <ul className="grid grid-cols-6 gap-1">
            {items.map(({ to, icon: Icon, key, label }) => {
              const active = loc.pathname.startsWith(to);
              return (
                <li key={to}>
                  <Link
                    to={to}
                    className={`flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-[10px] font-medium transition ${
                      active ? "bg-gold/15 text-gold" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="truncate">{key ? t(key) : label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
  );

  return requireAuth ? <RequireAuth roles={roles}>{shell}</RequireAuth> : shell;
}
