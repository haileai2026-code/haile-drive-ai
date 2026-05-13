import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminShell } from "@/components/AdminShell";
import { adminApi, type AttendanceMark } from "@/lib/admin-api";
import { useAuth } from "@/lib/auth";
import { CheckCircle2, Clock, XCircle, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";

type Search = { classId?: string; date?: string };

export const Route = createFileRoute("/teacher/attendance")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    classId: typeof s.classId === "string" ? s.classId : undefined,
    date: typeof s.date === "string" ? s.date : undefined,
  }),
  head: () => ({ meta: [{ title: "סימון נוכחות — Haile Drive AI" }] }),
  component: MarkAttendance,
});

const MARKS: { key: AttendanceMark; label: string; icon: typeof CheckCircle2; cls: string }[] = [
  { key: "present", label: "נוכח", icon: CheckCircle2, cls: "border-emerald-500/40 text-emerald-300 bg-emerald-500/10" },
  { key: "late", label: "איחור", icon: Clock, cls: "border-amber-500/40 text-amber-300 bg-amber-500/10" },
  { key: "missing", label: "חסר", icon: XCircle, cls: "border-rose-500/40 text-rose-300 bg-rose-500/10" },
  { key: "makeup_completed", label: "השלמה", icon: RotateCcw, cls: "border-sky-500/40 text-sky-300 bg-sky-500/10" },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function MarkAttendance() {
  const { classId, date: searchDate } = Route.useSearch();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [date, setDate] = useState(searchDate ?? todayISO());
  const [activeClassId, setActiveClassId] = useState<string | undefined>(classId);
  const [marks, setMarks] = useState<Record<string, AttendanceMark>>({});

  const classesQ = useQuery({ queryKey: ["classes"], queryFn: adminApi.listClasses, enabled: !!user });
  const myClasses = useMemo(
    () => (classesQ.data ?? []).filter((c) => c.teacher_id === user?.id),
    [classesQ.data, user?.id],
  );
  const currentClassId = activeClassId ?? myClasses[0]?.id;
  const cls = myClasses.find((c) => c.id === currentClassId);

  const candidatesQ = useQuery({
    queryKey: ["class-candidates", currentClassId],
    queryFn: () => adminApi.listCandidates({ teacherId: user!.id }),
    enabled: !!user && !!currentClassId,
    select: (rows) => rows.filter((r) => r.class_id === currentClassId),
  });

  const attendanceQ = useQuery({
    queryKey: ["attendance", currentClassId, date],
    queryFn: () => adminApi.listAttendance({ classId: currentClassId!, date }),
    enabled: !!currentClassId,
  });

  // Sync existing marks when data loads
  const existing = attendanceQ.data ?? [];
  const merged: Record<string, AttendanceMark> = useMemo(() => {
    const base: Record<string, AttendanceMark> = {};
    existing.forEach((r) => (base[r.candidate_id] = r.mark));
    return { ...base, ...marks };
  }, [existing, marks]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!currentClassId) return;
      const rows = Object.entries(merged).map(([candidate_id, mark]) => ({
        class_id: currentClassId,
        candidate_id,
        lesson_date: date,
        mark,
        marked_by: user!.id,
      }));
      await adminApi.upsertAttendance(rows);
    },
    onSuccess: () => {
      toast.success("הנוכחות נשמרה");
      qc.invalidateQueries({ queryKey: ["attendance"] });
      setMarks({});
    },
    onError: (e: any) => toast.error(e.message ?? "שמירה נכשלה"),
  });

  const set = (sid: string, m: AttendanceMark) => setMarks((p) => ({ ...p, [sid]: m }));
  const counts = MARKS.map((m) => ({ ...m, n: Object.values(merged).filter((x) => x === m.key).length }));
  const students = candidatesQ.data ?? [];

  return (
    <AdminShell title="סימון נוכחות" roles={["teacher", "owner"]}>
      <div className="mb-4 grid gap-2 sm:grid-cols-2">
        <select
          value={currentClassId ?? ""}
          onChange={(e) => setActiveClassId(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {myClasses.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
          {myClasses.length === 0 && <option value="">אין כיתות משובצות</option>}
        </select>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      {cls && (
        <div className="rounded-2xl border border-gold/30 bg-gradient-to-br from-amber-900/30 to-card p-4">
          <div className="text-[11px] uppercase tracking-wider text-gold/80">{cls.schedule ?? "—"}</div>
          <div className="mt-1 text-base font-bold">{students.length} תלמידים</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {counts.map((c) => (
              <span key={c.key} className={`rounded-full border px-2 py-0.5 text-[11px] ${c.cls}`}>{c.label}: {c.n}</span>
            ))}
          </div>
        </div>
      )}

      {students.length === 0 && currentClassId && (
        <div className="mt-4 rounded-2xl border border-border/60 bg-card/40 p-6 text-center text-sm text-muted-foreground">
          אין תלמידים משובצים לכיתה זו. <Link to="/admin/candidates" className="text-gold underline">שייך תלמידים</Link>
        </div>
      )}

      <ul className="mt-4 space-y-2">
        {students.map((s) => {
          const current = merged[s.id];
          return (
            <li key={s.id} className="rounded-2xl border border-border/60 bg-card/40 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-background/60 font-bold">
                    {(s.full_name ?? "?").slice(0, 1)}
                  </span>
                  <span className="text-sm font-semibold">{s.full_name}</span>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-1.5">
                {MARKS.map(({ key, label, icon: Icon, cls: tone }) => (
                  <button
                    key={key}
                    onClick={() => set(s.id, key)}
                    className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-[11px] transition ${
                      current === key ? tone : "border-border/50 text-muted-foreground hover:border-gold/30"
                    }`}
                  >
                    <Icon className="h-4 w-4" /> {label}
                  </button>
                ))}
              </div>
            </li>
          );
        })}
      </ul>

      {students.length > 0 && (
        <div className="sticky bottom-4 mt-6">
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || Object.keys(merged).length === 0}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gold py-3 text-sm font-bold text-gold-foreground shadow-[var(--shadow-gold)] disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saveMutation.isPending ? "שומר…" : "שמור נוכחות"}
          </button>
        </div>
      )}
    </AdminShell>
  );
}
