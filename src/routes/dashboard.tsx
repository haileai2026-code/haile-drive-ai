import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useI18n, localized } from "@/lib/i18n";
import { lessons } from "@/lib/mock-data";
import { Bot, CalendarClock, ChevronRight, Flame, PlayCircle, Trophy } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Haile Drive AI" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { t, lang } = useI18n();
  const overall = Math.round(lessons.reduce((s, l) => s + l.progress, 0) / lessons.length);
  const next = lessons.find((l) => l.progress > 0 && l.progress < 100) ?? lessons[0];

  return (
    <AppShell>
      <section className="space-y-2">
        <p className="text-sm text-muted-foreground">{t("welcome")}</p>
        <h1 className="text-3xl font-black tracking-tight">ሃይሌ 👋</h1>
      </section>

      <section className="mt-6 overflow-hidden rounded-3xl border border-gold/30 bg-gradient-to-br from-amber-900/40 via-card to-card p-5 shadow-[var(--shadow-gold)]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-gold/80">{t("yourProgress")}</p>
            <p className="mt-1 text-4xl font-black text-gradient-gold">{overall}%</p>
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
          <div className="mt-3 text-sm font-semibold">{t("upcomingTest")}</div>
          <div className="text-xs text-muted-foreground">Air brakes · 12 Q</div>
        </Link>
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">{t("continueLesson")}</h2>
          <Link to="/lessons" className="inline-flex items-center text-xs text-gold">
            {t("lessons")} <ChevronRight className="h-3 w-3 rtl:rotate-180" />
          </Link>
        </div>

        <Link
          to="/lessons/$lessonId"
          params={{ lessonId: next.id }}
          className="flex items-center gap-4 rounded-2xl border border-border/70 bg-card/60 p-3 transition hover:border-gold/40"
        >
          <div
            className="grid h-16 w-16 shrink-0 place-items-center rounded-xl text-gold-foreground"
            style={{ background: `linear-gradient(135deg, oklch(0.7 0.15 ${next.thumbnailHue}), oklch(0.45 0.1 ${next.thumbnailHue}))` }}
          >
            <PlayCircle className="h-7 w-7" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{localized(next.title, lang)}</div>
            <div className="text-xs text-muted-foreground">{next.duration} {t("minutes")} · {next.progress}%</div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-background/60">
              <div className="h-full rounded-full bg-gold" style={{ width: `${next.progress}%` }} />
            </div>
          </div>
        </Link>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-base font-semibold">{t("lessons")}</h2>
        <ul className="grid gap-2">
          {lessons.slice(0, 4).map((l) => (
            <li key={l.id}>
              <Link
                to="/lessons/$lessonId"
                params={{ lessonId: l.id }}
                className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/40 p-3 hover:border-gold/30"
              >
                <span
                  className="h-10 w-10 rounded-lg"
                  style={{ background: `linear-gradient(135deg, oklch(0.7 0.15 ${l.thumbnailHue}), oklch(0.4 0.1 ${l.thumbnailHue}))` }}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{localized(l.title, lang)}</div>
                  <div className="text-[11px] text-muted-foreground">{l.duration} {t("minutes")}</div>
                </div>
                <span className={`text-xs font-semibold ${l.progress === 100 ? "text-success" : "text-gold"}`}>
                  {l.progress === 100 ? t("completed") : `${l.progress}%`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </AppShell>
  );
}
