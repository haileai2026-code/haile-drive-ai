import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useQuery } from "@tanstack/react-query";
import { scheduleApi, type ScheduleEvent, type ScheduleEventType } from "@/lib/admin-api";
import { BookOpen, FileQuestion, RotateCcw, CalendarClock } from "lucide-react";

export const Route = createFileRoute("/schedule")({
  head: () => ({ meta: [{ title: "לוז שלי — Haile Drive AI" }] }),
  component: StudentSchedule,
});

const TYPE_META: Record<ScheduleEventType, { label: string; cls: string; Icon: any }> = {
  lesson: { label: "שיעור", cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300", Icon: BookOpen },
  exam: { label: "מבחן", cls: "border-amber-500/30 bg-amber-500/10 text-amber-300", Icon: FileQuestion },
  makeup: { label: "השלמה", cls: "border-sky-500/30 bg-sky-500/10 text-sky-300", Icon: RotateCcw },
};

function StudentSchedule() {
  const today = new Date().toISOString().slice(0, 10);
  const { data, isLoading } = useQuery({
    queryKey: ["my-schedule"],
    queryFn: () => scheduleApi.list({ from: today }),
  });

  const events = data ?? [];
  const grouped = new Map<string, ScheduleEvent[]>();
  events.forEach((e) => {
    if (!grouped.has(e.event_date)) grouped.set(e.event_date, []);
    grouped.get(e.event_date)!.push(e);
  });

  return (
    <AppShell>
      <section className="space-y-2">
        <p className="text-sm text-muted-foreground">לוח אישי</p>
        <h1 className="text-2xl font-black tracking-tight">השיעורים והמבחנים שלי</h1>
      </section>

      <div className="mt-6 space-y-5">
        {isLoading && <div className="text-sm text-muted-foreground">טוען…</div>}
        {!isLoading && events.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center">
            <CalendarClock className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">אין אירועים מתוזמנים</p>
          </div>
        )}
        {Array.from(grouped.entries()).map(([date, items]) => (
          <div key={date}>
            <div className="mb-2 text-sm font-bold text-gold">
              {new Date(date).toLocaleDateString("he-IL", { weekday: "long", day: "2-digit", month: "long" })}
            </div>
            <ul className="space-y-2">
              {items.map((ev) => {
                const meta = TYPE_META[ev.type];
                return (
                  <li key={ev.id} className="rounded-2xl border border-border/60 bg-card/40 p-3">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${meta.cls}`}>
                        <meta.Icon className="h-3 w-3" /> {meta.label}
                      </span>
                      <span className="truncate text-sm font-semibold">{ev.title}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {ev.start_time && `${ev.start_time.slice(0, 5)}`}
                      {ev.end_time && `–${ev.end_time.slice(0, 5)}`}
                      {ev.location && ` · ${ev.location}`}
                    </div>
                    {ev.notes && <p className="mt-1 text-xs text-muted-foreground">{ev.notes}</p>}
                    {ev.exam_id && ev.type === "exam" && (
                      <Link to="/quiz" className="mt-2 inline-block text-xs font-semibold text-gold">פתח מבחן ←</Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
