import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLoading, AdminShell } from "@/components/AdminShell";
import { adminApi, type AttendanceMark, type AttendanceRecord } from "@/lib/admin-api";
import { useAuth } from "@/lib/auth";
import { ArrowRight, CheckCircle2, Clock, RotateCcw, XCircle } from "lucide-react";

type Search = { classId?: string; date?: string; from?: string; to?: string };

export const Route = createFileRoute("/admin/attendance/drilldown")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    classId: typeof s.classId === "string" ? s.classId : undefined,
    date: typeof s.date === "string" ? s.date : undefined,
    from: typeof s.from === "string" ? s.from : undefined,
    to: typeof s.to === "string" ? s.to : undefined,
  }),
  head: () => ({ meta: [{ title: "פירוט נוכחות — Haile Drive AI" }] }),
  component: DrilldownPage,
});

const MARK_META: Record<AttendanceMark, { label: string; tone: string; icon: typeof CheckCircle2 }> = {
  present: { label: "נוכח", tone: "text-emerald-300 border-emerald-500/30 bg-emerald-500/10", icon: CheckCircle2 },
  late: { label: "איחור", tone: "text-amber-300 border-amber-500/30 bg-amber-500/10", icon: Clock },
  missing: { label: "חסר", tone: "text-rose-300 border-rose-500/30 bg-rose-500/10", icon: XCircle },
  makeup_completed: { label: "השלמה", tone: "text-sky-300 border-sky-500/30 bg-sky-500/10", icon: RotateCcw },
};

function daysAgoISO(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function DrilldownPage() {
  const { classId, date, from, to } = Route.useSearch();
  const { user, loading } = useAuth();
  const enabled = !loading && !!user;

  // If a single date is selected, scope to that day. Otherwise use [from..to] or default 30d.
  const effectiveFrom = date ?? from ?? daysAgoISO(30);
  const effectiveTo = date ?? to ?? daysAgoISO(0);

  const attendanceQ = useQuery({
    queryKey: ["attendance", "drill", classId ?? "all", effectiveFrom, effectiveTo],
    queryFn: () => adminApi.listAttendance({ classId, from: effectiveFrom, to: effectiveTo }),
    enabled,
  });
  const candidatesQ = useQuery({ queryKey: ["candidates"], queryFn: () => adminApi.listCandidates(), enabled });
  const classesQ = useQuery({ queryKey: ["classes"], queryFn: adminApi.listClasses, enabled });
  const teachersQ = useQuery({ queryKey: ["teachers-all"], queryFn: adminApi.listAllUsers, enabled });

  const records = attendanceQ.data ?? [];
  const candidates = candidatesQ.data ?? [];
  const classes = classesQ.data ?? [];
  const teachers = teachersQ.data ?? [];

  const candidateById = useMemo(() => Object.fromEntries(candidates.map((c) => [c.id, c])), [candidates]);
  const classById = useMemo(() => Object.fromEntries(classes.map((c) => [c.id, c])), [classes]);
  const teacherById = useMemo(() => Object.fromEntries(teachers.map((t) => [t.id, t])), [teachers]);

  const cls = classId ? classById[classId] : undefined;

  // Group by teacher (via class.teacher_id)
  const byTeacher = useMemo(() => {
    const m = new Map<string, { records: AttendanceRecord[]; counts: Record<string, number> }>();
    records.forEach((r) => {
      const tId = classById[r.class_id]?.teacher_id ?? "unassigned";
      const bucket = m.get(tId) ?? { records: [], counts: {} };
      bucket.records.push(r);
      bucket.counts[r.mark] = (bucket.counts[r.mark] ?? 0) + 1;
      m.set(tId, bucket);
    });
    return Array.from(m.entries()).sort((a, b) => b[1].records.length - a[1].records.length);
  }, [records, classById]);

  // Group by session (class_id + lesson_date)
  const bySession = useMemo(() => {
    const m = new Map<string, { class_id: string; lesson_date: string; records: AttendanceRecord[]; counts: Record<string, number> }>();
    records.forEach((r) => {
      const key = `${r.class_id}|${r.lesson_date}`;
      const bucket = m.get(key) ?? { class_id: r.class_id, lesson_date: r.lesson_date, records: [], counts: {} };
      bucket.records.push(r);
      bucket.counts[r.mark] = (bucket.counts[r.mark] ?? 0) + 1;
      m.set(key, bucket);
    });
    return Array.from(m.values()).sort((a, b) =>
      a.lesson_date === b.lesson_date ? a.class_id.localeCompare(b.class_id) : b.lesson_date.localeCompare(a.lesson_date),
    );
  }, [records]);

  const headerTitle = cls
    ? `פירוט: ${cls.name}${date ? ` · ${date}` : ""}`
    : date
      ? `פירוט נוכחות · ${date}`
      : `פירוט נוכחות (${effectiveFrom} → ${effectiveTo})`;

  return (
    <AdminShell title={headerTitle}>
      <div className="mb-4 flex items-center justify-between">
        <Link to="/admin/attendance" className="inline-flex items-center gap-1 text-xs text-gold hover:underline">
          <ArrowRight className="h-3.5 w-3.5 rotate-180" /> חזרה לסקירה
        </Link>
        <div className="text-xs text-muted-foreground">{records.length} סימונים</div>
      </div>

      {attendanceQ.isLoading && <AdminLoading />}

      {/* Top-line counts */}
      <section className="grid gap-3 sm:grid-cols-4">
        {(Object.keys(MARK_META) as AttendanceMark[]).map((k) => {
          const n = records.filter((r) => r.mark === k).length;
          const meta = MARK_META[k];
          const Icon = meta.icon;
          return (
            <div key={k} className={`rounded-2xl border p-4 ${meta.tone}`}>
              <div className="flex items-center gap-2 text-xs">
                <Icon className="h-4 w-4" /> {meta.label}
              </div>
              <div className="mt-2 text-2xl font-black">{n}</div>
            </div>
          );
        })}
      </section>

      {/* Per teacher */}
      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold">פילוח לפי מורה</h2>
        {byTeacher.length === 0 ? (
          <div className="rounded-2xl border border-border/60 bg-card/40 p-6 text-center text-sm text-muted-foreground">
            אין סימונים בטווח שנבחר.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/40">
            <table className="w-full text-sm">
              <thead className="bg-background/40 text-right text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">מורה</th>
                  <th className="px-3 py-2">נוכח</th>
                  <th className="px-3 py-2">איחור</th>
                  <th className="px-3 py-2">חסר</th>
                  <th className="px-3 py-2">השלמה</th>
                  <th className="px-3 py-2">סה״כ</th>
                  <th className="px-3 py-2">% השלמה</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {byTeacher.map(([tId, b]) => {
                  const total = b.records.length;
                  const completion = total
                    ? Math.round((((b.counts.present ?? 0) + (b.counts.makeup_completed ?? 0)) / total) * 100)
                    : 0;
                  const name = tId === "unassigned" ? "ללא שיוך" : teacherById[tId]?.full_name ?? tId.slice(0, 8);
                  return (
                    <tr key={tId}>
                      <td className="px-3 py-3 font-semibold">{name}</td>
                      <td className="px-3 py-3 text-emerald-300">{b.counts.present ?? 0}</td>
                      <td className="px-3 py-3 text-amber-300">{b.counts.late ?? 0}</td>
                      <td className="px-3 py-3 text-rose-300">{b.counts.missing ?? 0}</td>
                      <td className="px-3 py-3 text-sky-300">{b.counts.makeup_completed ?? 0}</td>
                      <td className="px-3 py-3 text-muted-foreground">{total}</td>
                      <td className="px-3 py-3 font-bold text-gold">{completion}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Per session */}
      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold">פילוח לפי מפגש</h2>
        {bySession.length === 0 ? (
          <div className="rounded-2xl border border-border/60 bg-card/40 p-6 text-center text-sm text-muted-foreground">
            אין מפגשים בטווח שנבחר.
          </div>
        ) : (
          <ul className="space-y-3">
            {bySession.map((s) => {
              const c = classById[s.class_id];
              const total = s.records.length;
              const completion = total
                ? Math.round((((s.counts.present ?? 0) + (s.counts.makeup_completed ?? 0)) / total) * 100)
                : 0;
              const teacher = c?.teacher_id ? teacherById[c.teacher_id]?.full_name : null;
              return (
                <li key={`${s.class_id}-${s.lesson_date}`} className="rounded-2xl border border-border/60 bg-card/40 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-bold">{c?.name ?? s.class_id.slice(0, 8)}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {s.lesson_date} {teacher ? `· ${teacher}` : ""}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(Object.keys(MARK_META) as AttendanceMark[]).map((k) => {
                        const n = s.counts[k] ?? 0;
                        if (!n) return null;
                        const meta = MARK_META[k];
                        return (
                          <span key={k} className={`rounded-full border px-2 py-0.5 text-[11px] ${meta.tone}`}>
                            {meta.label}: {n}
                          </span>
                        );
                      })}
                      <span className="rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[11px] font-bold text-gold">
                        {completion}%
                      </span>
                    </div>
                  </div>
                  <ul className="mt-3 grid gap-1 sm:grid-cols-2">
                    {s.records.map((r) => {
                      const meta = MARK_META[r.mark];
                      const Icon = meta.icon;
                      return (
                        <li
                          key={r.id}
                          className="flex items-center justify-between rounded-lg border border-border/40 bg-background/40 px-3 py-2 text-xs"
                        >
                          <span className="font-medium">
                            {candidateById[r.candidate_id]?.full_name ?? r.candidate_id.slice(0, 8)}
                          </span>
                          <span className={`inline-flex items-center gap-1 ${meta.tone.split(" ")[0]}`}>
                            <Icon className="h-3.5 w-3.5" /> {meta.label}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </AdminShell>
  );
}
