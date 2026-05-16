import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useQuery } from "@tanstack/react-query";
import { scheduleApi, adminApi, type ScheduleEvent, type ScheduleEventType } from "@/lib/admin-api";
import { supabase } from "@/integrations/supabase/client";
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
  const { data: events, isLoading } = useQuery({
    queryKey: ["my-schedule-all"],
    queryFn: () => scheduleApi.list({}),
  });
  const { data: classes } = useQuery({
    queryKey: ["classes-min"],
    queryFn: () => adminApi.listClasses(),
  });

  const teacherIds = Array.from(
    new Set((classes ?? []).map((c) => c.teacher_id).filter(Boolean) as string[]),
  );
  const { data: teachers } = useQuery({
    queryKey: ["teacher-profiles", teacherIds.sort().join(",")],
    enabled: teacherIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", teacherIds);
      if (error) throw error;
      return data ?? [];
    },
  });
  const teacherMap = new Map((teachers ?? []).map((t) => [t.id, t.full_name]));

  const classMap = new Map((classes ?? []).map((c) => [c.id, c]));
  const list = events ?? [];
  const grouped = new Map<string, ScheduleEvent[]>();
  list.forEach((e) => {
    if (!grouped.has(e.event_date)) grouped.set(e.event_date, []);
    grouped.get(e.event_date)!.push(e);
  });

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
          const dateHeader = d.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
          const shortDate = d.toLocaleDateString("he-IL", { day: "numeric", month: "numeric", year: "numeric" });
          return (
            <div key={date}>
              <div className="mb-2 text-sm font-bold text-gold">{dateHeader}</div>
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
                  const teacherName = cls?.teacher_id ? teacherMap.get(cls.teacher_id) ?? null : null;

                  // Live join window: 15min before start until end
                  let canJoin = false;
                  let isLiveNow = false;
                  if (ev.is_live && ev.room_url && ev.start_time) {
                    const start = new Date(`${ev.event_date}T${ev.start_time}`);
                    const end = ev.end_time
                      ? new Date(`${ev.event_date}T${ev.end_time}`)
                      : new Date(start.getTime() + 2 * 60 * 60 * 1000);
                    const now = new Date();
                    const openAt = new Date(start.getTime() - 15 * 60 * 1000);
                    canJoin = now >= openAt && now <= end;
                    isLiveNow = now >= start && now <= end;
                  }

                  return (
                    <li key={ev.id} className="rounded-2xl border border-border/60 bg-card/40 p-4">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${meta.cls}`}>
                          <meta.Icon className="h-3 w-3" /> {meta.label}
                        </span>
                        {ev.is_live && isLiveNow && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-[11px] font-bold text-rose-300">
                            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-rose-400" /> 🔴 LIVE
                          </span>
                        )}
                        {ev.is_live && !isLiveNow && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[11px] font-semibold text-gold">
                            📹 שיעור חי
                          </span>
                        )}
                      </div>
                      <dl className="space-y-1.5 text-sm">
                        <div className="flex gap-2">
                          <dt className="w-14 shrink-0 text-muted-foreground">כיתה:</dt>
                          <dd className="font-semibold text-foreground">{cls?.name ?? "—"}</dd>
                        </div>
                        <div className="flex gap-2">
                          <dt className="w-14 shrink-0 text-muted-foreground">שיעור:</dt>
                          <dd className="font-semibold text-foreground">{ev.title}</dd>
                        </div>
                        <div className="flex gap-2">
                          <dt className="w-14 shrink-0 text-muted-foreground">מורה:</dt>
                          <dd className="font-semibold text-foreground">{teacherName ?? "—"}</dd>
                        </div>
                        <div className="flex gap-2">
                          <dt className="w-14 shrink-0 text-muted-foreground">תאריך:</dt>
                          <dd className="font-semibold text-foreground">
                            {shortDate}
                            {time && <> | <span className="text-muted-foreground">שעה:</span> {time}</>}
                          </dd>
                        </div>
                        {ev.location && (
                          <div className="flex gap-2">
                            <dt className="w-14 shrink-0 text-muted-foreground">מיקום:</dt>
                            <dd className="text-foreground">{ev.location}</dd>
                          </div>
                        )}
                      </dl>
                      {ev.notes && <p className="mt-2 text-xs text-muted-foreground">{ev.notes}</p>}
                      {ev.is_live && canJoin && (
                        <Link
                          to="/classroom/$sessionId"
                          params={{ sessionId: ev.id }}
                          className="mt-3 inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2 text-sm font-bold text-gold-foreground shadow-lg shadow-gold/20"
                        >
                          🎥 הצטרף לשיעור
                        </Link>
                      )}
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
