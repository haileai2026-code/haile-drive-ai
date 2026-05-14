import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useQuery } from "@tanstack/react-query";
import { scheduleApi, adminApi, type ScheduleEvent, type ScheduleEventType } from "@/lib/admin-api";
import { BookOpen, FileQuestion, RotateCcw, CalendarClock } from "lucide-react";

export const Route = createFileRoute("/schedule")({
  head: () => ({ meta: [{ title: "הלו\"ז שלי — Haile Drive AI" }] }),
  component: StudentSchedule,
});

const TYPE_META: Record<ScheduleEventType, { label: string; cls: string; Icon: any }> = {
  lesson: { label: "שיעור", cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300", Icon: BookOpen },
  exam: { label: "מבחן", cls: "border-amber-500/30 bg-amber-500/10 text-amber-300", Icon: FileQuestion },
  makeup: { label: "השלמה", cls: "border-sky-500/30 bg-sky-500/10 text-sky-300", Icon: RotateCcw },
};

function StudentSchedule() {
  const today = new Date().toISOString().slice(0, 10);
  // RLS auto-filters to events matching the student's class_id (or candidate_id).
  const { data: events, isLoading } = useQuery({
    queryKey: ["my-schedule"],
    queryFn: () => scheduleApi.list({ from: today }),
  });
  const { data: classes } = useQuery({
    queryKey: ["classes-min"],
    queryFn: () => adminApi.listClasses(),
  });

  const classMap = new Map((classes ?? []).map((c) => [c.id, c]));
  const list = events ?? [];
  const grouped = new Map<string, ScheduleEvent[]>();
  list.forEach((e) => {
    if (!grouped.has(e.event_date)) grouped.set(e.event_date, []);
    grouped.get(e.event_date)!.push(e);
  });

  // Detect the student's class from the data they actually see.
  const myClassId = list.find((e) => e.class_id)?.class_id ?? null;
  const myClass = myClassId ? classMap.get(myClassId) : null;

  return (
    <AppShell>
      <section className="space-y-2">
        <p className="text-sm text-muted-foreground">לוח אישי</p>
        <h1 className="text-2xl font-black tracking-tight">הלו"ז שלי</h1>
        {myClass && (
          <p className="text-xs text-muted-foreground">
            כיתה: <span className="font-semibold text-foreground">{myClass.name}</span>
          </p>
        )}
      </section>

      <div className="mt-6 space-y-5">
        {isLoading && <div className="text-sm text-muted-foreground">טוען…</div>}
        {!isLoading && list.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center">
            <CalendarClock className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">אין אירועים מתוזמנים לכיתה שלך</p>
          </div>
        )}
        {Array.from(grouped.entries()).map(([date, items]) => {
          const d = new Date(date);
          const dateLabel = d.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
          return (
            <div key={date}>
              <div className="mb-2 text-sm font-bold text-gold">{dateLabel}</div>
              <ul className="space-y-2">
                {items.map((ev) => {
                  const meta = TYPE_META[ev.type];
                  const time =
                    ev.start_time && ev.end_time
                      ? `${ev.start_time.slice(0, 5)}–${ev.end_time.slice(0, 5)}`
                      : ev.start_time
                        ? ev.start_time.slice(0, 5)
                        : "";
                  const cls = ev.class_id ? classMap.get(ev.class_id) : null;
                  return (
                    <li key={ev.id} className="rounded-2xl border border-border/60 bg-card/40 p-3">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${meta.cls}`}>
                          <meta.Icon className="h-3 w-3" /> {meta.label}
                        </span>
                        <span className="truncate text-sm font-semibold">{ev.title}</span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {[dateLabel, ev.title, time].filter(Boolean).join(" | ")}
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        {cls && <>כיתה: {cls.name}</>}
                        {ev.location && <> · {ev.location}</>}
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
          );
        })}
      </div>
    </AppShell>
  );
}
