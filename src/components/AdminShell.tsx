import { Link, useLocation } from "@tanstack/react-router";
import {
  LayoutDashboard, Users, GraduationCap,
  Building2, ChevronRight, ClipboardCheck,
  UserCog, LogOut, FileText, FileQuestion, Loader2,
  CalendarClock,
  type LucideIcon,
} from "lucide-react";
import { useRole } from "@/lib/role";
import { LangSwitcher } from "./LangSwitcher";
import { RequireAuth } from "./RequireAuth";
import { useAuth } from "@/lib/auth";
import type { ReactNode } from "react";
import type { Role } from "@/lib/ops-data";

type NavItem = { to: string; icon: LucideIcon; label: string; roles: Role[] };

const NAV: NavItem[] = [
  { to: "/admin", icon: LayoutDashboard, label: "סקירת בעלים", roles: ["owner"] },
  { to: "/admin/candidates", icon: Users, label: "תלמידים ומועמדים", roles: ["owner"] },
  { to: "/admin/teachers", icon: UserCog, label: "מורים והרשאות", roles: ["owner"] },
  { to: "/admin/classes", icon: GraduationCap, label: "כיתות וקבוצות", roles: ["owner"] },
  { to: "/admin/attendance", icon: ClipboardCheck, label: "ניתוח נוכחות", roles: ["owner"] },
  { to: "/admin/materials", icon: FileText, label: "חומרי לימוד והעשרה", roles: ["owner"] },
  { to: "/admin/exams", icon: FileQuestion, label: "בנק מבחנים", roles: ["owner"] },
  { to: "/admin/cities", icon: Building2, label: "ערים ומסלולים", roles: ["owner"] },
  { to: "/teacher", icon: GraduationCap, label: "מסך מורה", roles: ["teacher"] },
  { to: "/teacher/attendance", icon: ClipboardCheck, label: "סימון נוכחות", roles: ["teacher"] },
];

const ROLE_LABEL: Record<Role, string> = {
  owner: "בעלים",
  staff: "צוות",
  teacher: "מורה",
  student: "תלמיד",
};

export function AdminShell({
  children,
  title,
  roles = ["owner"],
}: {
  children: ReactNode;
  title: string;
  roles?: Role[];
}) {
  const { role } = useRole();
  const { signOut, profile } = useAuth();
  const loc = useLocation();
  const items = NAV.filter((i) => i.roles.includes(role));

  return (
    <RequireAuth roles={roles}>
    <div className="min-h-screen bg-night text-foreground">
      <div className="mx-auto flex max-w-screen-2xl">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border/60 bg-card/40 p-4 lg:flex">
          <Link to="/admin" className="mb-6 flex items-center gap-2 px-2">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-gold to-amber-600 text-gold-foreground font-black shadow-[var(--shadow-gold)]">H</span>
            <div>
              <div className="text-sm font-bold">Haile Drive AI</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Operations</div>
            </div>
          </Link>

          <nav className="flex-1 space-y-1 overflow-y-auto">
            {items.map(({ to, icon: Icon, label }) => {
              const active = to === "/admin" ? loc.pathname === "/admin" : loc.pathname.startsWith(to);
              return (
                <Link
                  key={to}
                  to={to}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
                    active ? "bg-gold/15 text-gold" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="flex-1 truncate">{label}</span>
                  {active && <ChevronRight className="h-3 w-3 rtl:rotate-180" />}
                </Link>
              );
            })}
          </nav>

          <div className="mt-4 rounded-xl border border-border/60 bg-background/40 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">מחובר בתור</div>
            <div className="mt-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm font-semibold text-gold">
              {ROLE_LABEL[role]}
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl">
            <div className="flex items-center justify-between px-4 py-3 lg:px-8">
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Haile Drive AI</div>
                <h1 className="truncate text-lg font-bold tracking-tight lg:text-xl">{title}</h1>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-md border border-border/60 bg-background px-2 py-1.5 text-xs font-semibold text-gold lg:hidden">
                  {ROLE_LABEL[role]}
                </span>
                <LangSwitcher />
                <button
                  onClick={signOut}
                  title={profile?.email ?? "Sign out"}
                  className="rounded-md border border-border/60 p-1.5 text-muted-foreground hover:bg-accent"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex gap-1 overflow-x-auto px-4 pb-3 lg:hidden">
              {items.map(({ to, icon: Icon, label }) => {
                const active = to === "/admin" ? loc.pathname === "/admin" : loc.pathname.startsWith(to);
                return (
                  <Link
                    key={to}
                    to={to}
                    className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs ${
                      active
                        ? "border-gold/40 bg-gold/15 text-gold"
                        : "border-border/60 text-muted-foreground"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" /> {label}
                  </Link>
                );
              })}
            </div>
          </header>

          <main className="px-4 py-6 lg:px-8 lg:py-8" dir="rtl">{children}</main>
        </div>
      </div>
    </div>
    </RequireAuth>
  );
}

export function StatCard({
  label, value, hint, tone = "default", icon: Icon,
}: {
  label: string; value: string | number; hint?: string;
  tone?: "default" | "gold" | "warn" | "success" | "danger";
  icon?: LucideIcon;
}) {
  const toneCls = {
    default: "border-border/60",
    gold: "border-gold/40 bg-gradient-to-br from-amber-900/30 to-card",
    warn: "border-amber-500/30 bg-amber-500/5",
    success: "border-emerald-500/30 bg-emerald-500/5",
    danger: "border-rose-500/30 bg-rose-500/5",
  }[tone];
  return (
    <div className={`rounded-2xl border ${toneCls} p-4`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </div>
      <div className="mt-2 text-3xl font-black tracking-tight">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function AdminLoading({ label = "טוען נתונים חיים…" }: { label?: string }) {
  return (
    <div className="grid min-h-40 place-items-center rounded-2xl border border-border/60 bg-card/40 p-6 text-muted-foreground">
      <div className="flex items-center gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin text-gold" />
        <span>{label}</span>
      </div>
    </div>
  );
}
