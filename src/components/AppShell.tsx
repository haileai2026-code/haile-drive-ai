import { Link, useLocation } from "@tanstack/react-router";
import { LayoutDashboard, BookOpen, Bot, Trophy, Users, type LucideIcon } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { LangSwitcher } from "./LangSwitcher";
import type { ReactNode } from "react";

type NavItem = { to: string; icon: LucideIcon; key: "dashboard" | "lessons" | "aiTeacher" | "quiz" | "community" };

const items: NavItem[] = [
  { to: "/dashboard", icon: LayoutDashboard, key: "dashboard" },
  { to: "/lessons", icon: BookOpen, key: "lessons" },
  { to: "/ai", icon: Bot, key: "aiTeacher" },
  { to: "/quiz", icon: Trophy, key: "quiz" },
  { to: "/community", icon: Users, key: "community" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const loc = useLocation();

  return (
    <div className="min-h-screen bg-night pb-24">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-screen-md items-center justify-between px-4 py-3">
          <Link to="/dashboard" className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-gold to-amber-600 text-gold-foreground font-black shadow-[var(--shadow-gold)]">H</span>
            <span className="text-sm font-semibold tracking-tight">{t("appName")}</span>
          </Link>
          <LangSwitcher />
        </div>
      </header>

      <main className="mx-auto max-w-screen-md px-4 py-6">{children}</main>

      <nav className="fixed bottom-4 left-1/2 z-40 w-[calc(100%-2rem)] max-w-screen-md -translate-x-1/2 rounded-2xl border border-border/70 bg-card/90 p-2 shadow-[var(--shadow-elev)] backdrop-blur-xl">
        <ul className="grid grid-cols-5 gap-1">
          {items.map(({ to, icon: Icon, key }) => {
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
                  <span className="truncate">{t(key)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
