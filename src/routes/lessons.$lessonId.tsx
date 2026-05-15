import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useI18n, localized } from "@/lib/i18n";
import { lessons } from "@/lib/mock-data";
import { Headphones, Play, Pause, FileText, ArrowRight, RotateCcw } from "lucide-react";
import {
  getLessonProgress,
  saveLessonProgress,
  clearLessonProgress,
  formatTime,
} from "@/lib/lesson-progress";

export const Route = createFileRoute("/lessons/$lessonId")({
  head: () => ({ meta: [{ title: "Lesson — Haile Drive AI" }] }),
  component: LessonDetail,
  notFoundComponent: () => (
    <AppShell>
      <p className="text-muted-foreground">Lesson not found.</p>
      <Link to="/lessons" className="mt-4 inline-block text-gold">← Back</Link>
    </AppShell>
  ),
});

function LessonDetail() {
  const { lessonId } = Route.useParams();
  const { t, lang } = useI18n();
  const lesson = lessons.find((l) => l.id === lessonId);
  if (!lesson) throw notFound();

  const totalSec = lesson.duration * 60;
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [resumed, setResumed] = useState(false);
  const tickRef = useRef<number | null>(null);
  const positionRef = useRef(0);

  // Restore progress on mount
  useEffect(() => {
    const saved = getLessonProgress(lessonId);
    if (saved && saved.positionSec > 5 && saved.positionSec < totalSec - 3) {
      setPosition(saved.positionSec);
      positionRef.current = saved.positionSec;
      setResumed(true);
    }
  }, [lessonId, totalSec]);

  // Persist on unmount / page-hide so exiting mid-lesson is safe
  useEffect(() => {
    const persist = () => {
      saveLessonProgress({
        lessonId,
        positionSec: positionRef.current,
        durationSec: totalSec,
        updatedAt: Date.now(),
      });
    };
    window.addEventListener("pagehide", persist);
    window.addEventListener("beforeunload", persist);
    return () => {
      persist();
      window.removeEventListener("pagehide", persist);
      window.removeEventListener("beforeunload", persist);
    };
  }, [lessonId, totalSec]);

  // Playback "engine" — counts seconds. Persists every 5s.
  useEffect(() => {
    if (!playing) return;
    let lastSave = Date.now();
    tickRef.current = window.setInterval(() => {
      setPosition((p) => {
        const next = Math.min(totalSec, p + 1);
        positionRef.current = next;
        if (next >= totalSec) setPlaying(false);
        if (Date.now() - lastSave > 5000) {
          lastSave = Date.now();
          saveLessonProgress({
            lessonId,
            positionSec: next,
            durationSec: totalSec,
            updatedAt: Date.now(),
          });
        }
        return next;
      });
    }, 1000) as unknown as number;
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, [playing, lessonId, totalSec]);

  const pct = Math.round((position / totalSec) * 100);
  const remaining = Math.max(0, totalSec - position);
  const completed = position >= totalSec - 1;

  const togglePlay = () => {
    setResumed(false);
    setPlaying((p) => !p);
  };

  const restart = () => {
    setPlaying(false);
    setPosition(0);
    positionRef.current = 0;
    clearLessonProgress(lessonId);
    setResumed(false);
  };

  return (
    <AppShell>
      <Link to="/lessons" className="text-xs text-muted-foreground hover:text-gold">← {t("lessons")}</Link>
      <h1 className="mt-2 text-2xl font-black tracking-tight">{localized(lesson.title, lang)}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {lesson.duration} {t("minutes")} · נותרו {formatTime(remaining)}
      </p>

      {resumed && (
        <div className="mt-3 rounded-xl border border-gold/40 bg-gold/10 px-3 py-2 text-xs text-gold">
          ממשיך מהנקודה האחרונה ({formatTime(position)})
        </div>
      )}

      <div
        className="mt-5 grid aspect-video place-items-center rounded-3xl border border-gold/20 shadow-[var(--shadow-elev)]"
        style={{ background: `radial-gradient(circle at 50% 40%, oklch(0.6 0.15 ${lesson.thumbnailHue}), oklch(0.15 0.05 ${lesson.thumbnailHue}))` }}
      >
        <button
          onClick={togglePlay}
          className="grid h-20 w-20 place-items-center rounded-full bg-gold text-gold-foreground shadow-[var(--shadow-gold)] transition hover:scale-105"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <Pause className="h-10 w-10" /> : <Play className="h-10 w-10" />}
        </button>
      </div>

      <div className="mt-4">
        <div className="h-2 w-full overflow-hidden rounded-full bg-card/60">
          <div className="h-full rounded-full bg-gradient-to-r from-gold to-amber-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{formatTime(position)} / {formatTime(totalSec)}</span>
          <span>{pct}%</span>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={togglePlay}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gold/15 px-4 py-2 text-sm font-semibold text-gold hover:bg-gold/25"
        >
          {playing ? <><Pause className="h-4 w-4" /> השהה</> : <><Play className="h-4 w-4" /> {position > 0 && !completed ? "המשך" : "הפעל"}</>}
        </button>
        {position > 0 && (
          <button
            onClick={restart}
            className="inline-flex items-center gap-2 rounded-xl border border-border/60 px-3 py-2 text-xs text-muted-foreground hover:border-gold/40"
          >
            <RotateCcw className="h-3.5 w-3.5" /> התחל מחדש
          </button>
        )}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <button className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card/60 p-4 text-start hover:border-gold/40">
          <Headphones className="h-5 w-5 text-gold" />
          <div>
            <div className="text-sm font-semibold">በአማርኛ ድምጽ ማብራሪያ</div>
            <div className="text-xs text-muted-foreground">Audio in Amharic</div>
          </div>
        </button>
        <button className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card/60 p-4 text-start hover:border-gold/40">
          <FileText className="h-5 w-5 text-gold" />
          <div>
            <div className="text-sm font-semibold">כתוביות בעברית</div>
            <div className="text-xs text-muted-foreground">Hebrew subtitles</div>
          </div>
        </button>
      </div>

      <Link
        to="/quiz"
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-gold to-amber-600 px-6 py-3.5 text-base font-semibold text-gold-foreground shadow-[var(--shadow-gold)]"
      >
        {t("startQuiz")} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
      </Link>
    </AppShell>
  );
}
