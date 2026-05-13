import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AdminShell, AdminLoading } from "@/components/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { TrendingUp, AlertTriangle, CheckCircle2, XCircle, Eye, X, Search, Award } from "lucide-react";

export const Route = createFileRoute("/admin/progress")({
  head: () => ({ meta: [{ title: "התקדמות תלמידים — Admin" }] }),
  component: AdminProgressPage,
});

type FailedQ = { question: string; selected?: string; correct: string };
type ExamRow = {
  id: string;
  user_id: string;
  exam_title: string | null;
  category: string;
  score: number;
  total_questions: number;
  passed: boolean;
  failed_questions: FailedQ[];
  taken_at: string;
};
type Candidate = { id: string; full_name: string; phone: string | null };

const CATS: Record<string, string> = {
  rules: "חוקי תנועה",
  signs: "תמרורים",
  mechanics: "מכניקה",
  general: "כללי",
};

function AdminProgressPage() {
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<ExamRow[] | null>(null);
  const [reviewing, setReviewing] = useState<ExamRow | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("candidates")
        .select("id, full_name, phone")
        .order("full_name");
      const list = (data ?? []) as Candidate[];
      setCandidates(list);
      if (!selectedId && list.length) setSelectedId(list[0].id);
    })();
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setRows(null);
    (async () => {
      const { data } = await supabase
        .from("exam_results")
        .select("*")
        .eq("user_id", selectedId)
        .order("taken_at", { ascending: true });
      setRows((data ?? []) as unknown as ExamRow[]);
    })();
  }, [selectedId]);

  const filtered = useMemo(
    () =>
      (candidates ?? []).filter((c) =>
        c.full_name.toLowerCase().includes(search.toLowerCase()) ||
        (c.phone ?? "").includes(search),
      ),
    [candidates, search],
  );

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
    const weak = Object.entries(catCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const trend = rows.map((r, i) => ({
      name: `#${i + 1}`,
      score: Math.round(pct(r)),
      date: new Date(r.taken_at).toLocaleDateString("he-IL"),
    }));
    const last = trend[trend.length - 1]?.score ?? 0;
    const prev = trend[trend.length - 2]?.score ?? last;
    return { avg, passed, total: rows.length, weak, trend, delta: last - prev };
  }, [rows]);

  const selected = candidates?.find((c) => c.id === selectedId);

  return (
    <AdminShell title="התקדמות תלמידים" roles={["owner", "teacher"]}>
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        {/* Candidates list */}
        <aside className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              dir="rtl"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="חיפוש תלמיד…"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 pe-9 text-sm"
            />
          </div>
          {candidates === null ? (
            <AdminLoading />
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-border/60 bg-card/40 p-4 text-center text-xs text-muted-foreground">לא נמצאו תלמידים</div>
          ) : (
            <ul className="max-h-[70vh] space-y-1 overflow-y-auto rounded-xl border border-border/60 bg-card/40 p-2">
              {filtered.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => setSelectedId(c.id)}
                    className={`w-full rounded-lg px-3 py-2 text-start text-sm transition ${
                      selectedId === c.id ? "bg-gold/15 text-gold" : "hover:bg-accent"
                    }`}
                  >
                    <div className="truncate font-medium">{c.full_name}</div>
                    {c.phone && <div className="truncate text-[10px] text-muted-foreground">{c.phone}</div>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* Selected candidate */}
        <section className="min-w-0 space-y-4">
          {!selected ? (
            <div className="rounded-2xl border border-border/60 bg-card/40 p-10 text-center text-sm text-muted-foreground">
              בחר תלמיד להצגת ההתקדמות
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between rounded-2xl border border-gold/30 bg-gradient-to-br from-amber-900/20 to-card p-4">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-gold/80">תלמיד</div>
                  <div className="text-lg font-bold">{selected.full_name}</div>
                  {selected.phone && <div className="text-xs text-muted-foreground">{selected.phone}</div>}
                </div>
                <Award className="h-8 w-8 text-gold" />
              </div>

              {rows === null ? (
                <AdminLoading />
              ) : rows.length === 0 ? (
                <div className="rounded-2xl border border-border/60 bg-card/40 p-10 text-center text-sm text-muted-foreground">
                  אין מבחנים מתועדים לתלמיד זה
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-2xl border border-success/30 bg-success/10 p-4">
                      <div className="text-[10px] uppercase tracking-wider text-success">ממוצע</div>
                      <div className="mt-1 text-3xl font-black text-success">{stats!.avg}%</div>
                    </div>
                    <div className="rounded-2xl border border-gold/30 bg-gold/10 p-4">
                      <div className="text-[10px] uppercase tracking-wider text-gold">עבר</div>
                      <div className="mt-1 text-3xl font-black text-gold">
                        {stats!.passed}<span className="text-sm">/{stats!.total}</span>
                      </div>
                    </div>
                    <div className={`rounded-2xl border p-4 ${stats!.delta >= 0 ? "border-success/30 bg-success/10" : "border-destructive/30 bg-destructive/10"}`}>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">מגמה</div>
                      <div className={`mt-1 flex items-center gap-1 text-3xl font-black ${stats!.delta >= 0 ? "text-success" : "text-destructive"}`}>
                        <TrendingUp className={`h-6 w-6 ${stats!.delta < 0 ? "rotate-180" : ""}`} />
                        {stats!.delta >= 0 ? "+" : ""}{stats!.delta}%
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/70 bg-card/60 p-4">
                    <h2 className="mb-2 text-sm font-semibold">מגמת ציונים</h2>
                    <div className="h-64 w-full">
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
                  </div>

                  {stats!.weak.length > 0 && (
                    <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
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
                    </div>
                  )}

                  <div>
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
                  </div>
                </>
              )}
            </>
          )}
        </section>
      </div>

      {reviewing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4" onClick={() => setReviewing(null)}>
          <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-border/70 bg-card p-5 sm:rounded-3xl" onClick={(e) => e.stopPropagation()} dir="rtl">
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
                      <span><span className="font-semibold">תשובת התלמיד:</span> {q.selected}</span>
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
    </AdminShell>
  );
}
