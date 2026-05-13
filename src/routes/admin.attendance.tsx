import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLoading, AdminShell, StatCard } from "@/components/AdminShell";
import { adminApi } from "@/lib/admin-api";
import { useAuth } from "@/lib/auth";
import { CheckCircle2, Clock, XCircle, RotateCcw, AlertTriangle, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/admin/attendance")({
  head: () => ({ meta: [{ title: "ניתוח נוכחות — Haile Drive AI" }] }),
  component: AttendancePage,
});

const MARK_META = {
  present: { label: "נוכח", icon: CheckCircle2, tone: "text-emerald-300" },
  late: { label: "איחור", icon: Clock, tone: "text-amber-300" },
  missing: { label: "חסר", icon: XCircle, tone: "text-rose-300" },
  makeup_completed: { label: "השלמה", icon: RotateCcw, tone: "text-sky-300" },
} as const;

function daysAgoISO(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function AttendancePage() {
  const { user, loading } = useAuth();
  const enabled = !loading && !!user;
  const [windowDays, setWindowDays] = useState(30);

  const from = daysAgoISO(windowDays);
  const today = daysAgoISO(0);

  const attendanceQ = useQuery({
    queryKey: ["attendance", "range", from, today],
    queryFn: () => adminApi.listAttendance({ from, to: today }),
    enabled,
  });
  const candidatesQ = useQuery({ queryKey: ["candidates"], queryFn: () => adminApi.listCandidates(), enabled });
  const classesQ = useQuery({ queryKey: ["classes"], queryFn: adminApi.listClasses, enabled });

  const isLoading = attendanceQ.isLoading || candidatesQ.isLoading || classesQ.isLoading;
  const records = attendanceQ.data ?? [];
  const candidates = candidatesQ.data ?? [];
  const classes = classesQ.data ?? [];
  const candidateById = useMemo(() => Object.fromEntries(candidates.map((c) => [c.id, c])), [candidates]);
  const classById = useMemo(() => Object.fromEntries(classes.map((c) => [c.id, c])), [classes]);

  // Aggregate counts
  const counts = records.reduce<Record<string, number>>((acc, r) => {
    acc[r.mark] = (acc[r.mark] ?? 0) + 1;
    return acc;
  }, {});
  const total = records.length;
  const completionRate = total
    ? Math.round((((counts.present ?? 0) + (counts.makeup_completed ?? 0)) / total) * 100)
    : 0;

  // Today's missing
  const todayMissing = records.filter((r) => r.lesson_date === today && r.mark === "missing");

  // Risk students: ≥3 missing in window (excluding completed makeups)
  const perStudent: Record<string, { missing: number; total: number }> = {};
  records.forEach((r) => {
    const s = (perStudent[r.candidate_id] ??= { missing: 0, total: 0 });
    s.total += 1;
    if (r.mark === "missing") s.missing += 1;
  });
  const risk = Object.entries(perStudent)
    .map(([id, s]) => ({ id, ...s, rate: s.total ? s.missing / s.total : 0 }))
    .filter((s) => s.missing >= 3 || s.rate >= 0.4)
    .sort((a, b) => b.missing - a.missing);

  // Per-class completion
  const perClass: Record<string, { present: number; total: number }> = {};
  records.forEach((r) => {
    const c = (perClass[r.class_id] ??= { present: 0, total: 0 });
    c.total += 1;
    if (r.mark === "present" || r.mark === "makeup_completed") c.present += 1;
  });

  return (
    <AdminShell title="ניתוח נוכחות">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          חלון ניתוח: {windowDays} ימים אחרונים ({from} → {today})
        </div>
        <div className="flex gap-1">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setWindowDays(d)}
              className={`rounded-md border px-3 py-1.5 text-xs ${
                windowDays === d
                  ? "border-gold/50 bg-gold/15 text-gold"
                  : "border-border/60 text-muted-foreground hover:bg-accent"
              }`}
            >
              {d} ימים
            </button>
          ))}
        </div>
      </div>

      {isLoading && <AdminLoading />}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="שיעור השלמה" value={`${completionRate}%`} hint="נוכח + השלמה" tone="gold" icon={TrendingUp} />
        <StatCard label="חסרים היום" value={todayMissing.length} tone="danger" icon={XCircle} />
        <StatCard label="תלמידים בסיכון" value={risk.length} hint="3+ היעדרויות" tone="warn" icon={AlertTriangle} />
        <StatCard label="סה״כ סימונים" value={total} hint={`בחלון ${windowDays} ימים`} icon={CheckCircle2} />
      </div>

      <section className="mt-6 grid gap-3 sm:grid-cols-4">
        {(Object.keys(MARK_META) as (keyof typeof MARK_META)[]).map((k) => {
          const meta = MARK_META[k];
          const Icon = meta.icon;
          const n = counts[k] ?? 0;
          const pct = total ? Math.round((n / total) * 100) : 0;
          return (
            <div key={k} className="rounded-2xl border border-border/60 bg-card/40 p-4">
              <div className={`flex items-center gap-2 text-xs ${meta.tone}`}>
                <Icon className="h-4 w-4" /> {meta.label}
              </div>
              <div className="mt-2 text-2xl font-black">{n}</div>
              <div className="text-xs text-muted-foreground">{pct}%</div>
            </div>
          );
        })}
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold">תלמידים בסיכון</h2>
        {risk.length === 0 ? (
          <div className="rounded-2xl border border-border/60 bg-card/40 p-6 text-center text-sm text-muted-foreground">
            אין תלמידים בסיכון בחלון הנבחר.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-rose-500/20 bg-card/40">
            <table className="w-full text-sm">
              <thead className="bg-background/40 text-right text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">שם</th>
                  <th className="px-3 py-2">חסר</th>
                  <th className="px-3 py-2">סך מפגשים</th>
                  <th className="px-3 py-2">אחוז היעדרות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {risk.map((s) => {
                  const cand = candidateById[s.id];
                  return (
                    <tr key={s.id}>
                      <td className="px-3 py-3 font-semibold">{cand?.full_name ?? s.id.slice(0, 8)}</td>
                      <td className="px-3 py-3 text-rose-300">{s.missing}</td>
                      <td className="px-3 py-3 text-muted-foreground">{s.total}</td>
                      <td className="px-3 py-3">{Math.round(s.rate * 100)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold">שיעור השלמה לפי כיתה</h2>
        <div className="grid gap-2">
          {classes.map((c) => {
            const stats = perClass[c.id] ?? { present: 0, total: 0 };
            const pct = stats.total ? Math.round((stats.present / stats.total) * 100) : 0;
            return (
              <div key={c.id} className="rounded-2xl border border-border/60 bg-card/40 p-3">
                <div className="flex items-center justify-between text-sm">
                  <div className="font-semibold">{c.name}</div>
                  <div className="text-muted-foreground">
                    {stats.present}/{stats.total} · <span className="font-bold text-gold">{pct}%</span>
                  </div>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background/60">
                  <div className="h-full bg-gradient-to-r from-emerald-500 to-gold" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
          {classes.length === 0 && (
            <div className="text-sm text-muted-foreground">אין כיתות עדיין.</div>
          )}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold">חסרים היום</h2>
        {todayMissing.length === 0 ? (
          <div className="rounded-2xl border border-border/60 bg-card/40 p-6 text-center text-sm text-muted-foreground">
            אין היעדרויות מסומנות להיום.
          </div>
        ) : (
          <ul className="divide-y divide-border/40 overflow-hidden rounded-2xl border border-border/60 bg-card/40">
            {todayMissing.map((r) => (
              <li key={r.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div className="font-semibold">{candidateById[r.candidate_id]?.full_name ?? r.candidate_id.slice(0, 8)}</div>
                <div className="text-xs text-muted-foreground">{classById[r.class_id]?.name ?? "—"}</div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-6 text-xs text-muted-foreground">
        סימון נוכחות מתבצע במסך המורה. <Link to="/teacher/attendance" className="text-gold underline">פתח כעת</Link>
      </div>
    </AdminShell>
  );
}
