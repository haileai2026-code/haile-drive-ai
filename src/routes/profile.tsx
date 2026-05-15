import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Award, BarChart3, Bell, FileImage, GraduationCap, LogOut, Settings } from "lucide-react";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile — Haile Drive AI" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [profile, setProfile] = useState<{ full_name: string | null; phone: string | null; email: string | null } | null>(null);
  const [className, setClassName] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data: p } = await supabase
        .from("profiles")
        .select("full_name, phone, email")
        .eq("id", user.id)
        .maybeSingle();
      if (!cancelled) setProfile(p ?? null);

      // Find candidate row for this user (by email) and JOIN class name
      const email = p?.email ?? user.email ?? null;
      if (email) {
        const { data: cand } = await supabase
          .from("candidates")
          .select("class_id, classes:class_id(name)")
          .ilike("email", email)
          .maybeSingle();
        if (!cancelled) {
          const name = (cand as any)?.classes?.name ?? null;
          setClassName(name);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const items: { icon: typeof BarChart3; label: string; to?: string }[] = [
    { icon: BarChart3, label: "Analytics" },
    { icon: Award, label: "Certificates" },
    { icon: FileImage, label: "Document helper" },
    { icon: Bell, label: "Notifications" },
    { icon: Settings, label: "Translations (Admin)", to: "/admin/translations" },
  ];

  const displayName = profile?.full_name || profile?.email || user?.email || "—";
  const displayPhone = profile?.phone || "";

  return (
    <AppShell>
      <div className="flex items-center gap-4">
        <span className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-gold to-amber-600 text-2xl font-black text-gold-foreground shadow-[var(--shadow-gold)]">
          {displayName.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-black">{displayName}</h1>
          <p className="truncate text-xs text-muted-foreground">
            {[displayPhone, "Student"].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3 rounded-2xl border border-gold/30 bg-gradient-to-br from-amber-900/20 to-card p-4">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-gold/15 text-gold">
          <GraduationCap className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] uppercase tracking-wider text-gold/80">הכיתה שלי</div>
          <div className="truncate text-sm font-semibold">
            {className ?? "לא משויך/ת לכיתה"}
          </div>
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
