import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Activity, Bot, CalendarClock, ChevronRight, Flame, PlayCircle, Trophy } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Haile Drive AI" }] }),
  component: Dashboard,
});

type MaterialRow = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  type: string;
  external_link: string | null;
  file_url: string | null;
};

function Dashboard() {
  const { t } = useI18n();
  const { user } = useAuth();

  const [beqaScore, setBeqaScore] = useState<number | null>(null);
  const [beqaCount, setBeqaCount] = useState(0);
  const [examPassedCount, setExamPassedCount] = useState(0);
  const [examTotalCount, setExamTotalCount] = useState(0);
  const [lastExamTitle, setLastExamTitle] = useState<string | null>(null);
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [beqaRes, examRes, matRes] = await Promise.all([
        supabase
          .from("beqa_diagnostic_sessions")
          .select("final_beqa_score, end_time")
          .eq("student_id", user.id)
          .not("final_beqa_score", "is", null)
          .order("end_time", { ascending: false })
          .limit(20),
        supabase
          .from("exam_results")
          .select("passed, exam_title, taken_at")
          .eq("user_id", user.id)
          .order("taken_at", { ascending: false })
          .limit(20),
        supabase
          .from("materials")
          .select("id, title, description, category, type, external_link, file_url")
          .order("created_at", { ascending: false })
          .limit(8),
      ]);
      if (cancelled) return;
      const beqaRows = beqaRes.data ?? [];
      setBeqaCount(beqaRows.length);
      setBeqaScore(beqaRows[0]?.final_beqa_score != null ? Math.round(Number(beqaRows[0].final_beqa_score)) : null);
      const exams = examRes.data ?? [];
      setExamTotalCount(exams.length);
      setExamPassedCount(exams.filter((e) => e.passed).length);
      setLastExamTitle(exams[0]?.exam_title ?? null);
      setMaterials((matRes.data ?? []) as MaterialRow[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const overall = beqaScore ?? (examTotalCount > 0 ? Math.round((examPassedCount / examTotalCount) * 100) : 0);

  return (
    <AppShell>
      <section className="space-y-2">
        <p className="text-sm text-muted-foreground">{t("welcome")}</p>
        <h1 className="text-3xl font-black tracking-tight">{user?.email?.split("@")[0] ?? "👋"}</h1>
      </section>

      <section className="mt-6 overflow-hidden rounded-3xl border border-gold/30 bg-gradient-to-br from-amber-900/40 via-card to-card p-5 shadow-[var(--shadow-gold)]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-gold/80">
              {beqaScore != null ? "ציון BEQA אחרון" : t("yourProgress")}
            </p>
            <p className="mt-1 text-4xl font-black text-gradient-gold">{overall}%</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {beqaCount > 0
                ? `${beqaCount} סשנים · ${examPassedCount}/${examTotalCount} מבחנים`
                : examTotalCount > 0
                  ? `${examPassedCount}/${examTotalCount} מבחנים`
                  : "טרם בוצע אבחון"}
            </p>
          </div>
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gold/15 text-gold">
            <Flame className="h-8 w-8" />
          </div>
        </div>
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-background/60">
          <div className="h-full rounded-full bg-gradient-to-r from-gold to-amber-500" style={{ width: `${overall}%` }} />
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{t("motivation")}</p>
      </section>

      <section className="mt-6 grid grid-cols-2 gap-3">
        <Link to="/schedule" className="group rounded-2xl border border-gold/40 bg-gradient-to-br from-amber-900/30 to-card p-4 transition hover:border-gold">
          <CalendarClock className="h-6 w-6 text-gold" />
          <div className="mt-3 text-sm font-semibold">הלוז שלי</div>
          <div className="text-xs text-muted-foreground">שיעורים ומבחנים</div>
        </Link>
        <Link to="/ai" className="group rounded-2xl border border-border/70 bg-card/60 p-4 transition hover:border-gold/40">
          <Bot className="h-6 w-6 text-gold" />
          <div className="mt-3 text-sm font-semibold">{t("aiTeacher")}</div>
          <div className="text-xs text-muted-foreground">{t("askAnything")}</div>
        </Link>
        <Link to="/quiz" className="group rounded-2xl border border-border/70 bg-card/60 p-4 transition hover:border-gold/40">
          <Trophy className="h-6 w-6 text-gold" />
          <div className="mt-3 text-sm font-semibold">{t("quiz")}</div>
          <div className="text-xs text-muted-foreground">
            {lastExamTitle ? `אחרון: ${lastExamTitle}` : "התחל מבחן"}
          </div>
        </Link>
        <Link to="/diagnostics" className="group rounded-2xl border border-success/40 bg-card/60 p-4 transition hover:border-success">
          <Activity className="h-6 w-6 text-success" />
          <div className="mt-3 text-sm font-semibold">BEQA חי</div>
          <div className="text-xs text-muted-foreground">מצלמה · BPM · HRV</div>
        </Link>
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">חומרי לימוד</h2>
          <Link to="/lessons" className="inline-flex items-center text-xs text-gold">
            {t("lessons")} <ChevronRight className="h-3 w-3 rtl:rotate-180" />
          </Link>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-border/60 bg-card/40 p-6 text-center text-sm text-muted-foreground">
            טוען…
          </div>
        ) : materials.length === 0 ? (
          <div className="rounded-2xl border border-border/60 bg-card/40 p-6 text-center text-sm text-muted-foreground">
            עדיין אין חומרי לימוד זמינים. פנה למורה.
          </div>
        ) : (
          <ul className="grid gap-2">
            {materials.map((m) => {
              const href = m.external_link || m.file_url || "#";
              return (
                <li key={m.id}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/40 p-3 hover:border-gold/30"
                  >
                    <span className="grid h-10 w-10 place-items-center rounded-lg bg-gold/15 text-gold">
                      <PlayCircle className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{m.title}</div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {m.category} · {m.type}
                      </div>
                    </div>
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
