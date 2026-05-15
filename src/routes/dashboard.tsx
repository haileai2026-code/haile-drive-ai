import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { scheduleApi, type ScheduleEvent } from "@/lib/admin-api";
import {
  getLastLessonProgress,
  formatTime,
  type LessonProgress,
} from "@/lib/lesson-progress";
import {
  Activity, AlertTriangle, Bot, BookOpen, CalendarClock, ChevronRight,
  FileQuestion, Flame, PlayCircle, RotateCcw, Trophy,
} from "lucide-react";

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

const TYPE_META: Record<ScheduleEvent["type"], { label: string; cls: string; Icon: any }> = {
  lesson: { label: "שיעור", cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300", Icon: BookOpen },
  exam: { label: "מבחן", cls: "border-amber-500/30 bg-amber-500/10 text-amber-300", Icon: FileQuestion },
  makeup: { label: "השלמה", cls: "border-sky-500/30 bg-sky-500/10 text-sky-300", Icon: RotateCcw },
};

function todayISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

function eventStartDate(ev: ScheduleEvent): Date | null {
  if (!ev.start_time) return new Date(`${ev.event_date}T23:59:00`);
  return new Date(`${ev.event_date}T${ev.start_time}`);
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "מתחיל עכשיו";
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `בעוד ${h} שע׳ ${m} דק׳`;
  if (m > 0) return `בעוד ${m} דק׳`;
  const s = Math.floor(ms / 1000);
  return `בעוד ${s} שנ׳`;
}

function Dashboard() {
  const { t } = useI18n();
  const { user } = useAuth();

  const [beqaScore, setBeqaScore] = useState<number | null>(null);
  const [beqaCount, setBeqaCount] = useState(0);
  const [examPassedCount, setExamPassedCount] = useState(0);
  const [examTotalCount, setExamTotalCount] = useState(0);
  const [lastExamTitle, setLastExamTitle] = useState<string | null>(null);
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [todayEvents, setTodayEvents] = useState<ScheduleEvent[]>([]);
  const [resume, setResume] = useState<LessonProgress | null>(null);
  const [now, setNow] = useState<number>(Date.now());
  const [loading, setLoading] = useState(true);

  // Pull resume info from localStorage
  useEffect(() => {
    setResume(getLastLessonProgress());
  }, []);

  // Live clock for countdowns
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const today = todayISO();
      const [beqaRes, examRes, matRes, schedRes] = await Promise.all([
        supabase.from("beqa_diagnostic_sessions")
          .select("final_beqa_score, end_time")
          .eq("student_id", user.id)
          .not("final_beqa_score", "is", null)
          .order("end_time", { ascending: false }).limit(20),
        supabase.from("exam_results")
          .select("passed, exam_title, taken_at")
          .eq("user_id", user.id)
          .order("taken_at", { ascending: false }).limit(20),
        supabase.from("materials")
          .select("id, title, description, category, type, external_link, file_url")
          .order("created_at", { ascending: false }).limit(8),
        scheduleApi.list({ from: today, to: today }).catch(() => [] as ScheduleEvent[]),
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
      setTodayEvents(schedRes);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const overall = beqaScore ?? (examTotalCount > 0 ? Math.round((examPassedCount / examTotalCount) * 100) : 0);

  const sortedToday = useMemo(
    () => [...todayEvents].sort((a, b) => (eventStartDate(a)!.getTime() - eventStartDate(b)!.getTime())),
    [todayEvents],
  );
  const upcomingExam = useMemo(() => {
    return sortedToday.find((e) => e.type === "exam" && (eventStartDate(e)?.getTime() ?? 0) >= now)
      ?? sortedToday.find((e) => e.type === "exam");
  }, [sortedToday, now]);

  const resumePct = resume ? Math.round((resume.positionSec / Math.max(1, resume.durationSec)) * 100) : 0;
  const resumeActive = !!(resume && resume.positionSec > 5 && resume.positionSec < resume.durationSec - 3);

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

      {/* Resume lesson */}
      {resumeActive && resume && (
        <section className="mt-4">
          <Link
            to="/lessons/$lessonId"
            params={{ lessonId: resume.lessonId }}
            className="flex items-center gap-3 rounded-2xl border border-emerald-500/40 bg-gradient-to-br from-emerald-900/30 to-card p-4 transition hover:border-emerald-400"
          >
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500/20 text-emerald-300">
              <PlayCircle className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] uppercase tracking-wider text-emerald-300">המשך מהנקודה האחרונה</div>
              <div className="truncate text-sm font-semibold">השיעור האחרון שלך</div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-background/60">
                <div className="h-full rounded-full bg-emerald-400" style={{ width: `${resumePct}%` }} />
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                {formatTime(resume.positionSec)} / {formatTime(resume.durationSec)} · {resumePct}%
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-emerald-300 rtl:rotate-180" />
          </Link>
        </section>
      )}

      {/* Today's schedule */}
      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">הלו"ז של היום</h2>
          <Link to="/schedule" className="inline-flex items-center text-xs text-gold">
            כל הלו"ז <ChevronRight className="h-3 w-3 rtl:rotate-180" />
          </Link>
        </div>

        {upcomingExam && (
          <div className="mb-3 flex items-start gap-3 rounded-2xl border border-amber-500/50 bg-gradient-to-br from-amber-900/40 to-card p-3 shadow-[var(--shadow-gold)]">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-500/20 text-amber-300">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-bold uppercase tracking-wider text-amber-300">מבחן קרוב</div>
              <div className="truncate text-sm font-semibold">{upcomingExam.title}</div>
              <div className="text-[11px] text-muted-foreground">
                {upcomingExam.start_time?.slice(0, 5) ?? ""}
                {" · "}
                {formatCountdown((eventStartDate(upcomingExam)?.getTime() ?? 0) - now)}
              </div>
            </div>
            {upcomingExam.exam_id && (
              <Link to="/quiz" className="self-center rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-bold text-amber-950">
                פתח
              </Link>
            )}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl border border-border/60 bg-card/40 p-4 text-center text-sm text-muted-foreground">טוען…</div>
        ) : sortedToday.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 bg-card/40 p-5 text-center text-sm text-muted-foreground">
            <CalendarClock className="mx-auto h-6 w-6 text-muted-foreground" />
            <div className="mt-2">אין שיעורים או מבחנים מתוזמנים להיום</div>
          </div>
        ) : (
          <ul className="space-y-2">
            {sortedToday.map((ev) => {
              const meta = TYPE_META[ev.type];
              const start = eventStartDate(ev);
              const startMs = start?.getTime() ?? 0;
              const diff = startMs - now;
              const past = diff < -60_000;
              const time = ev.start_time && ev.end_time
                ? `${ev.start_time.slice(0, 5)}–${ev.end_time.slice(0, 5)}`
                : ev.start_time?.slice(0, 5) ?? "";
              const isExam = ev.type === "exam";
              return (
                <li
                  key={ev.id}
                  className={`rounded-2xl border p-3 ${
                    isExam && !past
                      ? "border-amber-500/40 bg-amber-500/5"
                      : "border-border/60 bg-card/40"
                  } ${past ? "opacity-60" : ""}`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${meta.cls}`}>
                      <meta.Icon className="h-3 w-3" /> {meta.label}
                    </span>
                    <span className="truncate text-sm font-semibold">{ev.title}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{time}{ev.location ? ` · ${ev.location}` : ""}</span>
                    <span className={isExam && !past ? "font-semibold text-amber-300" : ""}>
                      {past ? "הסתיים" : formatCountdown(diff)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
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
          <div className="rounded-2xl border border-border/60 bg-card/40 p-6 text-center text-sm text-muted-foreground">טוען…</div>
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
