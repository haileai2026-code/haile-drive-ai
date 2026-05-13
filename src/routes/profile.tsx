import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { Award, BarChart3, Bell, FileImage, LogOut, Settings } from "lucide-react";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile — Haile Drive AI" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { t } = useI18n();
  const items: { icon: typeof BarChart3; label: string; to?: string }[] = [
    { icon: BarChart3, label: "Analytics" },
    { icon: Award, label: "Certificates" },
    { icon: FileImage, label: "Document helper" },
    { icon: Bell, label: "Notifications" },
    { icon: Settings, label: "Translations (Admin)", to: "/admin/translations" },
  ];
  return (
    <AppShell>
      <div className="flex items-center gap-4">
        <span className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-gold to-amber-600 text-2xl font-black text-gold-foreground shadow-[var(--shadow-gold)]">
          ሃ
        </span>
        <div>
          <h1 className="text-xl font-black">ሃይሌ ተስፋ</h1>
          <p className="text-xs text-muted-foreground">+972 50 123 4567 · Student</p>
        </div>
      </div>

      <ul className="mt-6 divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/70 bg-card/50">
        {items.map((i) => {
          const inner = (
            <>
              <i.icon className="h-5 w-5 text-gold" />
              <span className="flex-1 text-sm">{i.label}</span>
              <span className="text-muted-foreground">›</span>
            </>
          );
          return (
            <li key={i.label}>
              {i.to ? (
                <Link to={i.to} className="flex w-full items-center gap-3 px-4 py-3.5 text-start hover:bg-card">{inner}</Link>
              ) : (
                <button className="flex w-full items-center gap-3 px-4 py-3.5 text-start hover:bg-card">{inner}</button>
              )}
            </li>
          );
        })}
      </ul>

      <Link to="/" className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">
        <LogOut className="h-4 w-4" /> {t("login")}
      </Link>
    </AppShell>
  );
}
