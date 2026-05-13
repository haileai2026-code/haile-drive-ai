import { createFileRoute } from "@tanstack/react-router";
import { AdminShell, AdminLoading } from "@/components/AdminShell";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi, scheduleApi, type ScheduleEvent, type ScheduleEventType } from "@/lib/admin-api";
import { useState, useMemo } from "react";
import { Plus, Trash2, Pencil, BookOpen, FileQuestion, RotateCcw, CalendarRange, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const WEEKDAYS = [
  { v: 0, label: "א׳" },
  { v: 1, label: "ב׳" },
  { v: 2, label: "ג׳" },
  { v: 3, label: "ד׳" },
  { v: 4, label: "ה׳" },
  { v: 5, label: "ו׳" },
  { v: 6, label: "ש׳" },
];

type RecurringForm = {
  title: string;
  type: ScheduleEventType;
  class_id: string;
  location: string;
  start_time: string;
  end_time: string;
  start_date: string;
  weekdays: number[];
  mode: "count" | "until";
  count: number;
  until_date: string;
};

function generateDates(start: string, weekdays: number[], mode: "count" | "until", count: number, until: string): string[] {
  const out: string[] = [];
  if (!weekdays.length) return out;
  const startD = new Date(start + "T00:00:00");
  const endLimit = mode === "until" ? new Date(until + "T00:00:00") : null;
  const maxIter = 366 * 2;
  for (let i = 0; i < maxIter; i++) {
    const d = new Date(startD);
    d.setDate(startD.getDate() + i);
    if (endLimit && d > endLimit) break;
    if (weekdays.includes(d.getDay())) {
      out.push(d.toISOString().slice(0, 10));
      if (mode === "count" && out.length >= count) break;
    }
  }
  return out;
}

export const Route = createFileRoute("/admin/schedule")({
  head: () => ({ meta: [{ title: "לוז שיעורים — Haile Drive AI" }] }),
  component: SchedulePage,
});

const TYPE_META: Record<ScheduleEventType, { label: string; cls: string; Icon: any }> = {
  lesson: { label: "שיעור", cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300", Icon: BookOpen },
  exam: { label: "מבחן", cls: "border-amber-500/30 bg-amber-500/10 text-amber-300", Icon: FileQuestion },
  makeup: { label: "השלמה", cls: "border-sky-500/30 bg-sky-500/10 text-sky-300", Icon: RotateCcw },
};

type Form = Partial<ScheduleEvent> & { title: string; event_date: string; type: ScheduleEventType };

function SchedulePage() {
  const qc = useQueryClient();
  const [filterClass, setFilterClass] = useState<string>("");
  const [editing, setEditing] = useState<Form | null>(null);
  const [recurring, setRecurring] = useState<RecurringForm | null>(null);
  const [conflicts, setConflicts] = useState<Array<{ candidate: any; with: any }> | null>(null);
  const [previewDates, setPreviewDates] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const { data: events, isLoading } = useQuery({
    queryKey: ["schedule", filterClass],
    queryFn: () => scheduleApi.list(filterClass ? { classId: filterClass } : undefined),
  });
  const { data: classes } = useQuery({ queryKey: ["classes"], queryFn: adminApi.listClasses });
  const { data: exams } = useQuery({ queryKey: ["exams"], queryFn: adminApi.listExams });
  const { data: candidates } = useQuery({ queryKey: ["candidates"], queryFn: () => adminApi.listCandidates() });

  const className = (id: string | null) => classes?.find((c) => c.id === id)?.name ?? "—";

  const grouped = useMemo(() => {
    const map = new Map<string, ScheduleEvent[]>();
    (events ?? []).forEach((e) => {
      const k = e.event_date;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(e);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [events]);

  async function save() {
    if (!editing) return;
    try {
      await scheduleApi.upsert({
        ...editing,
        class_id: editing.class_id || null,
        exam_id: editing.type === "exam" ? editing.exam_id || null : null,
        candidate_id: editing.type === "makeup" ? editing.candidate_id || null : null,
      });
      toast.success("נשמר");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["schedule"] });
    } catch (e: any) {
      toast.error(e.message ?? "שגיאה");
    }
  }

  async function remove(id: string) {
    if (!confirm("למחוק את האירוע?")) return;
    await scheduleApi.remove(id);
    qc.invalidateQueries({ queryKey: ["schedule"] });
  }

  function buildRecurringPayload(r: RecurringForm, dates: string[]) {
    return dates.map((d) => ({
      type: r.type,
      title: r.title,
      class_id: r.class_id || null,
      event_date: d,
      start_time: r.start_time || null,
      end_time: r.end_time || null,
      location: r.location || null,
    }));
  }

  async function checkRecurring() {
    if (!recurring) return;
    if (!recurring.title.trim()) { toast.error("חסר שם השיעור"); return; }
    const dates = generateDates(recurring.start_date, recurring.weekdays, recurring.mode, recurring.count, recurring.until_date);
    if (!dates.length) { toast.error("לא נוצרו תאריכים — בחר ימים בשבוע"); return; }
    setBusy(true);
    try {
      const payload = buildRecurringPayload(recurring, dates);
      const found = await scheduleApi.findConflicts(payload);
      setPreviewDates(dates);
      setConflicts(found);
    } catch (e: any) {
      toast.error(e.message ?? "שגיאה");
    } finally {
      setBusy(false);
    }
  }

  async function commitRecurring(skipConflicts: boolean) {
    if (!recurring) return;
    const conflictDates = new Set((conflicts ?? []).map((c) => c.candidate.event_date));
    const dates = skipConflicts ? previewDates.filter((d) => !conflictDates.has(d)) : previewDates;
    if (!dates.length) { toast.error("אין תאריכים ליצירה"); return; }
    setBusy(true);
    try {
      const payload = buildRecurringPayload(recurring, dates);
      const { inserted } = await scheduleApi.bulkCreate(payload);
      toast.success(`נוצרו ${inserted} אירועים`);
      setRecurring(null);
      setConflicts(null);
      setPreviewDates([]);
      qc.invalidateQueries({ queryKey: ["schedule"] });
    } catch (e: any) {
      toast.error(e.message ?? "שגיאה");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell title="לוז שיעורים ומבחנים">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setEditing({ title: "", event_date: new Date().toISOString().slice(0, 10), type: "lesson" })}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-gold px-4 text-sm font-semibold text-gold-foreground"
        >
          <Plus className="h-4 w-4" /> אירוע חדש
        </button>
        <select
          value={filterClass}
          onChange={(e) => setFilterClass(e.target.value)}
          className="h-10 rounded-xl border border-border/60 bg-background/40 px-3 text-sm"
        >
          <option value="">כל הכיתות</option>
          {classes?.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="mt-6 space-y-6">
        {isLoading && <AdminLoading />}
        {!isLoading && grouped.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
            אין אירועים מתוזמנים
          </div>
        )}
        {grouped.map(([date, items]) => (
          <div key={date}>
            <div className="mb-2 text-sm font-bold text-gold">
              {new Date(date).toLocaleDateString("he-IL", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
            </div>
            <ul className="space-y-2">
              {items.map((ev) => {
                const meta = TYPE_META[ev.type];
                return (
                  <li
                    key={ev.id}
                    className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/40 p-3"
                  >
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${meta.cls}`}>
                      <meta.Icon className="h-3 w-3" /> {meta.label}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{ev.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {className(ev.class_id)}
                        {ev.start_time && ` · ${ev.start_time.slice(0, 5)}`}
                        {ev.end_time && `–${ev.end_time.slice(0, 5)}`}
                        {ev.location && ` · ${ev.location}`}
                      </div>
                    </div>
                    <button onClick={() => setEditing(ev as Form)} className="rounded-lg border border-border/60 p-1.5 text-muted-foreground hover:text-foreground">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => remove(ev.id)} className="rounded-lg border border-border/60 p-1.5 text-rose-400 hover:bg-rose-500/10">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={() => setEditing(null)}>
          <div className="w-full max-w-md space-y-3 rounded-2xl border border-border/60 bg-card p-5" dir="rtl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold">{editing.id ? "עריכת אירוע" : "אירוע חדש"}</h3>

            <label className="block text-xs">סוג
              <select
                value={editing.type}
                onChange={(e) => setEditing({ ...editing, type: e.target.value as ScheduleEventType })}
                className="mt-1 h-10 w-full rounded-lg border border-border/60 bg-background px-3 text-sm"
              >
                <option value="lesson">שיעור</option>
                <option value="exam">מבחן מתוזמן</option>
                <option value="makeup">מועד השלמה</option>
              </select>
            </label>

            <label className="block text-xs">כותרת
              <input
                value={editing.title}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-border/60 bg-background px-3 text-sm"
                placeholder="שם השיעור / המבחן"
              />
            </label>

            <label className="block text-xs">כיתה
              <select
                value={editing.class_id ?? ""}
                onChange={(e) => setEditing({ ...editing, class_id: e.target.value || null })}
                className="mt-1 h-10 w-full rounded-lg border border-border/60 bg-background px-3 text-sm"
              >
                <option value="">— ללא —</option>
                {classes?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>

            {editing.type === "exam" && (
              <label className="block text-xs">קישור למבחן
                <select
                  value={editing.exam_id ?? ""}
                  onChange={(e) => setEditing({ ...editing, exam_id: e.target.value || null })}
                  className="mt-1 h-10 w-full rounded-lg border border-border/60 bg-background px-3 text-sm"
                >
                  <option value="">— ללא —</option>
                  {exams?.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
                </select>
              </label>
            )}

            {editing.type === "makeup" && (
              <label className="block text-xs">תלמיד (אופציונלי)
                <select
                  value={editing.candidate_id ?? ""}
                  onChange={(e) => setEditing({ ...editing, candidate_id: e.target.value || null })}
                  className="mt-1 h-10 w-full rounded-lg border border-border/60 bg-background px-3 text-sm"
                >
                  <option value="">— ללא —</option>
                  {candidates?.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                </select>
              </label>
            )}

            <div className="grid grid-cols-3 gap-2">
              <label className="block text-xs">תאריך
                <input
                  type="date"
                  value={editing.event_date}
                  onChange={(e) => setEditing({ ...editing, event_date: e.target.value })}
                  className="mt-1 h-10 w-full rounded-lg border border-border/60 bg-background px-2 text-sm"
                />
              </label>
              <label className="block text-xs">משעה
                <input
                  type="time"
                  value={editing.start_time?.slice(0, 5) ?? ""}
                  onChange={(e) => setEditing({ ...editing, start_time: e.target.value || null })}
                  className="mt-1 h-10 w-full rounded-lg border border-border/60 bg-background px-2 text-sm"
                />
              </label>
              <label className="block text-xs">עד שעה
                <input
                  type="time"
                  value={editing.end_time?.slice(0, 5) ?? ""}
                  onChange={(e) => setEditing({ ...editing, end_time: e.target.value || null })}
                  className="mt-1 h-10 w-full rounded-lg border border-border/60 bg-background px-2 text-sm"
                />
              </label>
            </div>

            <label className="block text-xs">מיקום
              <input
                value={editing.location ?? ""}
                onChange={(e) => setEditing({ ...editing, location: e.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-border/60 bg-background px-3 text-sm"
                placeholder="כיתה / סניף"
              />
            </label>

            <label className="block text-xs">הערות
              <textarea
                value={editing.notes ?? ""}
                onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                className="mt-1 w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
                rows={2}
              />
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setEditing(null)} className="rounded-lg border border-border/60 px-4 py-2 text-sm">ביטול</button>
              <button onClick={save} className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-gold-foreground">שמור</button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
