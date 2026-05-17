import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { adminApi, scheduleApi, type Material, type ScheduleEvent } from "@/lib/admin-api";
import { CalendarClock, FileText, Image as ImageIcon, Link as LinkIcon, PlayCircle } from "lucide-react";

export const Route = createFileRoute("/lessons")({
  head: () => ({ meta: [{ title: "Lessons — Haile Drive AI" }] }),
  component: LessonsPage,
});

const ICONS = { pdf: FileText, image: ImageIcon, link: LinkIcon, video: PlayCircle } as const;

function LessonsPage() {
  const { t } = useI18n();
  const matsQ = useQuery({ queryKey: ["materials"], queryFn: () => adminApi.listMaterials() });
  const scheduleQ = useQuery({ queryKey: ["my-lessons-schedule"], queryFn: () => scheduleApi.list({}) });
  const classesQ = useQuery({ queryKey: ["classes-min"], queryFn: () => adminApi.listClasses() });

  const study = (matsQ.data ?? []).filter((m) => m.category === "study");
  const enrichment = (matsQ.data ?? []).filter((m) => m.category === "enrichment");
  const scheduledLessons = (scheduleQ.data ?? [])
    .filter((event) => event.type === "lesson")
    .sort((a, b) => `${a.event_date} ${a.start_time ?? ""}`.localeCompare(`${b.event_date} ${b.start_time ?? ""}`));
  const classMap = new Map((classesQ.data ?? []).map((c) => [c.id, c.name]));

  return (
    <AppShell>
      <h1 className="text-2xl font-black tracking-tight">{t("lessons")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">שיעורי הכיתה שלך וחומרי לימוד שהוקצו לך</p>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gold">שיעורים מתוזמנים</h2>
          <Link to="/schedule" className="text-xs font-semibold text-gold">כל הלו״ז ←</Link>
        </div>
        {scheduleQ.isLoading && <div className="text-sm text-muted-foreground">טוען שיעורים…</div>}
        {!scheduleQ.isLoading && scheduledLessons.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border/60 bg-card/40 p-6 text-center text-sm text-muted-foreground">
            <CalendarClock className="mx-auto h-7 w-7 text-muted-foreground" />
            <p className="mt-2">אין שיעורים מתוזמנים לכיתה שלך</p>
          </div>
        )}
        {scheduledLessons.length > 0 && <ScheduledLessonsList items={scheduledLessons} classMap={classMap} />}
      </section>

      {matsQ.isLoading && <div className="mt-8 text-sm text-muted-foreground">טוען…</div>}
      {!matsQ.isLoading && (matsQ.data?.length ?? 0) === 0 && (
        <div className="mt-8 rounded-2xl border border-border/60 bg-card/40 p-6 text-center text-sm text-muted-foreground">
          טרם הוקצו חומרי לימוד.
        </div>
      )}

      {study.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-sm font-bold text-gold">חומרי לימוד</h2>
          <MaterialGrid items={study} />
        </section>
      )}
      {enrichment.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-sm font-bold text-gold">חומרי העשרה</h2>
          <MaterialGrid items={enrichment} />
        </section>
      )}
    </AppShell>
  );
}

function MaterialGrid({ items }: { items: Material[] }) {
  const open = async (m: Material, e: React.MouseEvent) => {
    if (!m.file_url || m.external_link) return;
    e.preventDefault();
    try {
      const signed = await adminApi.getMaterialSignedUrl(m.file_url);
      window.open(signed, "_blank", "noopener");
    } catch { /* noop */ }
  };
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {items.map((m) => {
        const Icon = ICONS[m.type];
        const url = m.file_url ?? m.external_link ?? "#";
        return (
          <li key={m.id}>
            <a href={url} onClick={(e) => open(m, e)} target="_blank" rel="noreferrer" className="group block rounded-2xl border border-border/70 bg-card/50 p-4 transition hover:border-gold/40">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-gold/15 text-gold"><Icon className="h-5 w-5" /></div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{m.title}</div>
                  {m.description && <div className="mt-1 text-xs text-muted-foreground">{m.description}</div>}
                </div>
              </div>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

function ScheduledLessonsList({ items, classMap }: { items: ScheduleEvent[]; classMap: Map<string, string> }) {
  return (
    <ul className="space-y-2">
      {items.map((event) => {
        const date = new Date(event.event_date).toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
        const time = event.start_time && event.end_time
          ? `${event.start_time.slice(0, 5)}–${event.end_time.slice(0, 5)}`
          : event.start_time?.slice(0, 5) ?? "";
        const className = event.class_id ? classMap.get(event.class_id) : null;
        return (
          <li key={event.id} className="rounded-2xl border border-border/60 bg-card/40 p-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300">
                <PlayCircle className="h-3 w-3" /> שיעור
              </span>
              <span className="truncate text-sm font-semibold">{event.title}</span>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              {[className, time, event.location].filter(Boolean).join(" · ")}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">{date}</div>
            {event.notes && <p className="mt-2 text-xs text-muted-foreground">{event.notes}</p>}
          </li>
        );
      })}
    </ul>
  );
}
