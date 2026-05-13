import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { lessons } from "@/lib/mock-data";
import { PlayCircle } from "lucide-react";

export const Route = createFileRoute("/lessons")({
  head: () => ({ meta: [{ title: "Lessons — Haile Drive AI" }] }),
  component: LessonsPage,
});

function LessonsPage() {
  const { t, lang } = useI18n();
  return (
    <AppShell>
      <h1 className="text-2xl font-black tracking-tight">{t("lessons")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">Bus & heavy-vehicle curriculum</p>

      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {lessons.map((l) => (
          <li key={l.id}>
            <Link
              to="/lessons/$lessonId"
              params={{ lessonId: l.id }}
              className="group block overflow-hidden rounded-2xl border border-border/70 bg-card/50 transition hover:border-gold/40"
            >
              <div
                className="relative aspect-[16/10]"
                style={{ background: `linear-gradient(135deg, oklch(0.65 0.15 ${l.thumbnailHue}), oklch(0.3 0.08 ${l.thumbnailHue}))` }}
              >
                <PlayCircle className="absolute inset-0 m-auto h-12 w-12 text-white/90 drop-shadow-lg transition group-hover:scale-110" />
                <div className="absolute bottom-2 end-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
                  {l.duration} {t("minutes")}
                </div>
              </div>
              <div className="p-3">
                <div className="text-sm font-semibold">{l.title[lang]}</div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-background/60">
                  <div className="h-full bg-gold" style={{ width: `${l.progress}%` }} />
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
