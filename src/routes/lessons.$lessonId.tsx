import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { lessons } from "@/lib/mock-data";
import { Headphones, PlayCircle, FileText, ArrowRight } from "lucide-react";

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

  return (
    <AppShell>
      <Link to="/lessons" className="text-xs text-muted-foreground hover:text-gold">← {t("lessons")}</Link>
      <h1 className="mt-2 text-2xl font-black tracking-tight">{lesson.title[lang]}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{lesson.duration} {t("minutes")}</p>

      <div
        className="mt-5 grid aspect-video place-items-center rounded-3xl border border-gold/20 shadow-[var(--shadow-elev)]"
        style={{ background: `radial-gradient(circle at 50% 40%, oklch(0.6 0.15 ${lesson.thumbnailHue}), oklch(0.15 0.05 ${lesson.thumbnailHue}))` }}
      >
        <button className="grid h-20 w-20 place-items-center rounded-full bg-gold text-gold-foreground shadow-[var(--shadow-gold)] transition hover:scale-105">
          <PlayCircle className="h-10 w-10" />
        </button>
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

      <section className="mt-8 rounded-2xl border border-border/60 bg-card/40 p-5">
        <h2 className="text-base font-semibold">አስፈላጊ ማስታወሻዎች</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li>• ሁልጊዜ ከመንዳትዎ በፊት የአየር ግፊት ይፈትሹ።</li>
          <li>• ዝቅተኛ ግፊት ማስጠንቀቂያ ሲሰማ ወዲያውኑ ይቁሙ።</li>
          <li>• ብሬክ ሲጫን ሁልጊዜ ቀስ ብሎ ይጫኑ።</li>
        </ul>
      </section>

      <Link
        to="/quiz"
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-gold to-amber-600 px-6 py-3.5 text-base font-semibold text-gold-foreground shadow-[var(--shadow-gold)]"
      >
        {t("startQuiz")} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
      </Link>
    </AppShell>
  );
}
