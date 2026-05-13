import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Award, TrendingUp, AlertTriangle, CheckCircle2, XCircle, Eye, X } from "lucide-react";

export const Route = createFileRoute("/progress")({
  head: () => ({ meta: [{ title: "ההתקדמות שלי — Haile Drive AI" }] }),
  component: ProgressPage,
});

type FailedQ = { question: string; selected?: string; correct: string };
type ExamRow = {
  id: string;
  exam_title: string | null;
  category: string;
  score: number;
  total_questions: number;
  passed: boolean;
  failed_questions: FailedQ[];
  taken_at: string;
};

const CATS: Record<string, string> = {
  rules: "חוקי תנועה",
  signs: "תמרורים",
  mechanics: "מכניקה",
  general: "כללי",
};

function ProgressPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<ExamRow[] | null>(null);
  const [reviewing, setReviewing] = useState<ExamRow | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("exam_results")
        .select("*")
        .eq("user_id", user.id)
        .order("taken_at", { ascending: true });
      setRows((data ?? []) as ExamRow[]);
    })();
  }, [user]);

  const stats = useMemo(() => {
    if (!rows || rows.length === 0) return null;
    const pct = (r: ExamRow) => (r.total_questions ? (r.score / r.total_questions) * 100 : 0);
    const avg = Math.round(rows.reduce((s, r) => s + pct(r), 0) / rows.length);
    const passed = rows.filter((r) => r.passed).length;

    const catCounts: Record<string, number> = {};
    rows.forEach((r) =>
      (r.failed_questions || []).forEach(() => {
        catCounts[r.category] = (catCounts[r.category] || 0) + 1;
      }),
    );
    const weak = Object.entries(catCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    const trend = rows.map((r, i) => ({
      name: `#${i + 1}`,
      score: Math.round(pct(r)),
      date: new Date(r.taken_at).toLocaleDateString("he-IL"),
    }));

    const last = trend[trend.length - 1]?.score ?? 0;
    const prev = trend[trend.length - 2]?.score ?? last;
    const delta = last - prev;

    return { avg, passed, total: rows.length, weak, trend, delta };
  }, [rows]);

  return (
    <AppShell>
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-widest text-gold/80">Analytics</p>
        <h1 className="text-3xl font-black tracking-tight">ההתקדמות שלי</h1>
        <p className="text-sm text-muted-foreground">סטטיסטיקות, מגמות ונקודות לחיזוק</p>
      </header>

      {rows === null ? (
        <div className="mt-8 grid gap-3">
          <div className="h-28 animate-pulse rounded-3xl bg-card/50" />
          <div className="h-64 animate-pulse rounded-3xl bg-card/50" />
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-10 rounded-3xl border border-border/70 bg-card/50 p-10 text-center">
          <Award className="mx-auto h-10 w-10 text-gold" />
          <p className="mt-3 text-sm text-muted-foreground">עדיין לא ביצעת מבחנים. התחל מהמבחן הראשון שלך!</p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <section className="mt-6 grid grid-cols-3 gap-2">
            <div className="rounded-2xl border border-success/30 bg-success/10 p-3">
              <div className="text-[10px] uppercase tracking-wider text-success">ממוצע</div>
              <div className="mt-1 text-2xl font-black text-success">{stats!.avg}%</div>
            </div>
            <div className="rounded-2xl border border-gold/30 bg-gold/10 p-3">
              <div className="text-[10px] uppercase tracking-wider text-gold">עברתי</div>
              <div className="mt-1 text-2xl font-black text-gold">
                {stats!.passed}<span className="text-sm">/{stats!.total}</span>
              </div>
            </div>
            <div className={`rounded-2xl border p-3 ${stats!.delta >= 0 ? "border-success/30 bg-success/10" : "border-destructive/30 bg-destructive/10"}`}>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">מגמה</div>
              <div className={`mt-1 flex items-center gap-1 text-2xl font-black ${stats!.delta >= 0 ? "text-success" : "text-destructive"}`}>
                <TrendingUp className={`h-5 w-5 ${stats!.delta < 0 ? "rotate-180" : ""}`} />
                {stats!.delta >= 0 ? "+" : ""}{stats!.delta}%
              </div>
            </div>
          </section>

          {/* Trend chart */}
          <section className="mt-6 rounded-3xl border border-border/70 bg-card/60 p-4">
            <h2 className="mb-2 text-sm font-semibold">מגמת ציונים</h2>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats!.trend} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                    formatter={(v: number) => [`${v}%`, "ציון"]}
                    labelFormatter={(_, p) => p?.[0]?.payload?.date ?? ""}
                  />
                  <Line type="monotone" dataKey="score" stroke="#f5b800" strokeWidth={3} dot={{ r: 4, fill: "#f5b800" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Weak points */}
          {stats!.weak.length > 0 && (
            <section className="mt-6 rounded-3xl border border-destructive/30 bg-destructive/5 p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <h2 className="text-sm font-semibold text-destructive">נקודות לחיזוק</h2>
              </div>
              <ul className="mt-3 space-y-2">
                {stats!.weak.map(([cat, count]) => (
                  <li key={cat} className="flex items-center justify-between rounded-xl bg-background/40 px-3 py-2">
                    <span className="text-sm font-medium">{CATS[cat] || cat}</span>
                    <span className="text-xs text-destructive">{count} שגיאות</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* History */}
          <section className="mt-6">
            <h2 className="mb-3 text-base font-semibold">היסטוריית מבחנים</h2>
            <ul className="space-y-2">
              {[...rows].reverse().map((r) => {
                const pct = r.total_questions ? Math.round((r.score / r.total_questions) * 100) : 0;
                return (
                  <li key={r.id} className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card/50 p-3">
                    <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl text-sm font-black ${r.passed ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
                      {pct}%
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{r.exam_title || CATS[r.category] || "מבחן"}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {new Date(r.taken_at).toLocaleDateString("he-IL")} · {r.passed ? "עבר" : "נכשל"}
                      </div>
                    </div>
                    {r.failed_questions?.length > 0 && (
                      <button
                        onClick={() => setReviewing(r)}
                        className="inline-flex items-center gap-1 rounded-xl border border-gold/40 bg-gold/10 px-3 py-2 text-xs font-semibold text-gold hover:bg-gold/20"
                      >
                        <Eye className="h-3.5 w-3.5" /> סקור טעויות
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}

      {/* Review modal */}
      {reviewing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4" onClick={() => setReviewing(null)}>
          <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-border/70 bg-card p-5 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">סקירת טעויות</h3>
              <button onClick={() => setReviewing(null)} className="rounded-lg p-1 hover:bg-accent"><X className="h-5 w-5" /></button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{reviewing.exam_title || CATS[reviewing.category]}</p>
            <ul className="mt-4 space-y-3">
              {reviewing.failed_questions.map((q, i) => (
                <li key={i} className="rounded-2xl border border-border/60 bg-background/40 p-3">
                  <p className="text-sm font-semibold">{q.question}</p>
                  {q.selected && (
                    <div className="mt-2 flex items-start gap-2 rounded-lg bg-destructive/10 p-2 text-xs">
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                      <span><span className="font-semibold">תשובתך:</span> {q.selected}</span>
                    </div>
                  )}
                  <div className="mt-2 flex items-start gap-2 rounded-lg bg-success/10 p-2 text-xs">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    <span><span className="font-semibold">תשובה נכונה:</span> {q.correct}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </AppShell>
  );
}
