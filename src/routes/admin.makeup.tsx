import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { AdminLoading, AdminShell, StatCard } from "@/components/AdminShell";
import { adminApi, type MakeupAssignment, type MakeupStatus } from "@/lib/admin-api";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Calendar, ArrowLeftRight, CheckCircle2, XCircle, Loader2, Lightbulb } from "lucide-react";

export const Route = createFileRoute("/admin/makeup")({
  head: () => ({ meta: [{ title: "השלמות שיעורים — Haile Drive AI" }] }),
  component: MakeupPage,
});

const STATUS_LABEL: Record<MakeupStatus, string> = {
  pending: "ממתין לשיבוץ",
  scheduled: "משובץ",
  completed: "הושלם",
  cancelled: "בוטל",
};

const STATUS_TONE: Record<MakeupStatus, string> = {
  pending: "border-amber-500/40 text-amber-300 bg-amber-500/5",
  scheduled: "border-gold/40 text-gold bg-gold/10",
  completed: "border-emerald-500/40 text-emerald-300 bg-emerald-500/5",
  cancelled: "border-rose-500/40 text-rose-300 bg-rose-500/5",
};

function MakeupPage() {
  const { user, loading } = useAuth();
  const enabled = !loading && !!user;
  const qc = useQueryClient();
  const [filter, setFilter] = useState<MakeupStatus | "all">("all");

  const makeupQ = useQuery({ queryKey: ["makeup"], queryFn: () => adminApi.listMakeup(), enabled });
  const classesQ = useQuery({ queryKey: ["classes"], queryFn: adminApi.listClasses, enabled });
  const candidatesQ = useQuery({ queryKey: ["candidates"], queryFn: () => adminApi.listCandidates(), enabled });

  const classes = classesQ.data ?? [];
  const candidates = candidatesQ.data ?? [];
  const all = makeupQ.data ?? [];
  const list = filter === "all" ? all : all.filter((m) => m.status === filter);

  const counts = useMemo(() => all.reduce<Record<string, number>>((acc, m) => {
    acc[m.status] = (acc[m.status] ?? 0) + 1; return acc;
  }, {}), [all]);

  const candidateById = useMemo(() => new Map(candidates.map((c) => [c.id, c])), [candidates]);
  const classById = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);

  const isLoading = makeupQ.isLoading || classesQ.isLoading || candidatesQ.isLoading;

  return (
    <AdminShell title="השלמות שיעורים">
      <section className="mb-6 rounded-2xl border border-gold/30 bg-gradient-to-br from-amber-900/25 via-card/60 to-card/30 p-5">
        <p className="text-xs font-semibold text-gold">מנוע שיבוץ אוטומטי</p>
        <h2 className="mt-1 text-2xl font-black tracking-tight">תלמידים שפספסו שיעור — שיבוץ להשלמה</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          כל סימון "חסר" בלוח הנוכחות פותח אוטומטית רשומת השלמה. בחר/י כיתה ותאריך — המערכת מציעה התאמות לפי עיר ונושא.
        </p>
      </section>

      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="ממתין" value={counts.pending ?? 0} tone="warn" icon={Calendar} />
        <StatCard label="משובץ" value={counts.scheduled ?? 0} tone="gold" icon={Calendar} />
        <StatCard label="הושלם" value={counts.completed ?? 0} tone="success" icon={CheckCircle2} />
        <StatCard label="בוטל" value={counts.cancelled ?? 0} tone="danger" icon={XCircle} />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {(["all", "pending", "scheduled", "completed", "cancelled"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`rounded-full border px-3 py-1.5 text-xs ${
              filter === k ? "border-gold/60 bg-gold/15 text-gold" : "border-border/60 text-muted-foreground hover:bg-accent"
            }`}
          >
            {k === "all" ? `הכול (${all.length})` : `${STATUS_LABEL[k]} (${counts[k] ?? 0})`}
          </button>
        ))}
      </div>

      {isLoading && <div className="mt-6"><AdminLoading /></div>}

      {!isLoading && list.length === 0 && (
        <div className="mt-6 rounded-2xl border border-border/60 bg-card/40 p-8 text-center text-sm text-muted-foreground">
          אין רשומות בקטגוריה זו.
        </div>
      )}

      <ul className="mt-4 grid gap-3">
        {list.map((m) => (
          <MakeupRow
            key={m.id}
            row={m}
            candidate={candidateById.get(m.candidate_id)}
            sourceClass={classById.get(m.source_class_id)}
            targetClass={m.target_class_id ? classById.get(m.target_class_id) : undefined}
            classes={classes}
            onChanged={() => qc.invalidateQueries({ queryKey: ["makeup"] })}
          />
        ))}
      </ul>
    </AdminShell>
  );
}

function MakeupRow({
  row, candidate, sourceClass, targetClass, classes, onChanged,
}: {
  row: MakeupAssignment;
  candidate: any;
  sourceClass: any;
  targetClass: any;
  classes: any[];
  onChanged: () => void;
}) {
  const [targetClassId, setTargetClassId] = useState<string>(row.target_class_id ?? "");
  const [targetDate, setTargetDate] = useState<string>(row.target_date ?? new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState<string>(row.notes ?? "");

  // Suggestions: same city as source class, exclude same source, prioritize teacher availability
  const suggestions = useMemo(() => {
    if (!sourceClass) return classes.slice(0, 3);
    return classes
      .filter((c) => c.id !== sourceClass.id)
      .sort((a, b) => {
        const aSame = a.city_id === sourceClass.city_id ? -1 : 1;
        const bSame = b.city_id === sourceClass.city_id ? -1 : 1;
        return aSame - bSame;
      })
      .slice(0, 3);
  }, [classes, sourceClass]);

  const assignMut = useMutation({
    mutationFn: () => adminApi.assignMakeup(row.id, targetClassId, targetDate, notes || undefined),
    onSuccess: () => { toast.success("השיבוץ נשמר"); onChanged(); },
    onError: (e: any) => toast.error(e?.message ?? "שגיאה בשמירה"),
  });

  const statusMut = useMutation({
    mutationFn: (status: MakeupStatus) => adminApi.setMakeupStatus(row.id, status),
    onSuccess: () => { toast.success("הסטטוס עודכן"); onChanged(); },
    onError: (e: any) => toast.error(e?.message ?? "שגיאה בעדכון"),
  });

  const isFinal = row.status === "completed" || row.status === "cancelled";

  return (
    <li className="rounded-2xl border border-border/60 bg-card/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-base font-semibold">{candidate?.full_name ?? "תלמיד לא ידוע"}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            פספס: <span className="font-medium text-foreground">{sourceClass?.name ?? "—"}</span> · {row.source_date}
          </div>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${STATUS_TONE[row.status]}`}>
          {STATUS_LABEL[row.status]}
        </span>
      </div>

      {!isFinal && (
        <>
          {suggestions.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-gold/20 bg-gold/5 p-2">
              <Lightbulb className="h-3.5 w-3.5 text-gold" />
              <span className="text-[11px] text-muted-foreground">הצעות:</span>
              {suggestions.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setTargetClassId(c.id)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] ${
                    targetClassId === c.id ? "border-gold/60 bg-gold/15 text-gold" : "border-border/60 hover:bg-accent"
                  }`}
                >
                  {c.name}{c.schedule ? ` · ${c.schedule}` : ""}
                </button>
              ))}
            </div>
          )}

          <div className="mt-3 grid gap-2 md:grid-cols-[1fr_180px_auto]">
            <select
              value={targetClassId}
              onChange={(e) => setTargetClassId(e.target.value)}
              className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
            >
              <option value="">בחר/י כיתת השלמה…</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}{c.schedule ? ` · ${c.schedule}` : ""}</option>
              ))}
            </select>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
            />
            <button
              onClick={() => assignMut.mutate()}
              disabled={!targetClassId || !targetDate || assignMut.isPending}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gold px-4 text-sm font-semibold text-gold-foreground disabled:opacity-50"
            >
              {assignMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowLeftRight className="h-4 w-4" />}
              {row.status === "scheduled" ? "עדכן שיבוץ" : "שבץ"}
            </button>
          </div>

          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="הערות (אופציונלי)"
            className="mt-2 h-9 w-full rounded-xl border border-input bg-background px-3 text-xs"
          />
        </>
      )}

      {row.status === "scheduled" && targetClass && (
        <div className="mt-3 rounded-xl border border-gold/20 bg-background/40 p-2 text-xs text-muted-foreground">
          משובץ ל: <span className="font-semibold text-foreground">{targetClass.name}</span> · {row.target_date}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {row.status !== "completed" && (
          <button
            onClick={() => statusMut.mutate("completed")}
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 px-3 py-1 text-xs text-emerald-300 hover:bg-emerald-500/10"
          >
            <CheckCircle2 className="h-3.5 w-3.5" /> סמן כהושלם
          </button>
        )}
        {row.status !== "cancelled" && row.status !== "completed" && (
          <button
            onClick={() => statusMut.mutate("cancelled")}
            className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/40 px-3 py-1 text-xs text-rose-300 hover:bg-rose-500/10"
          >
            <XCircle className="h-3.5 w-3.5" /> בטל
          </button>
        )}
        {(row.status === "completed" || row.status === "cancelled") && (
          <button
            onClick={() => statusMut.mutate("pending")}
            className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-1 text-xs text-muted-foreground hover:bg-accent"
          >
            החזר ל"ממתין"
          </button>
        )}
      </div>
    </li>
  );
}
