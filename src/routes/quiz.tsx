import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { CheckCircle2, XCircle, RotateCcw, FileQuestion } from "lucide-react";

export const Route = createFileRoute("/quiz")({
  head: () => ({ meta: [{ title: "Quiz — Haile Drive AI" }] }),
  component: QuizPage,
});

type Option = { id: string; option_text: string; order_index: number };
type Question = { id: string; question_text: string; image_url: string | null; order_index: number; options: Option[] };
type Exam = { id: string; title: string; description: string | null; questions: Question[] };

function QuizPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  // answers keyed by question id -> option id
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const [result, setResult] = useState<{ score: number; total: number; correctByQuestion: Record<string, string> } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: exams } = await supabase
        .from("exams")
        .select("id, title, description")
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .limit(1);
      const first = exams?.[0];
      if (!first) { if (!cancelled) { setExam(null); setLoading(false); } return; }
      const { data: qs } = await supabase
        .from("exam_questions")
        .select("id, question_text, image_url, order_index")
        .eq("exam_id", first.id)
        .order("order_index", { ascending: true });
      // Options come from a SECURITY DEFINER RPC that does not expose is_correct
      const { data: opts } = await supabase.rpc("get_exam_options", { p_exam_id: first.id });
      if (cancelled) return;
      const byQ: Record<string, Option[]> = {};
      (opts ?? []).forEach((o: any) => {
        (byQ[o.question_id] ||= []).push({ id: o.id, option_text: o.option_text, order_index: o.order_index });
      });
      const questions: Question[] = (qs ?? []).map((q: any) => ({
        id: q.id,
        question_text: q.question_text,
        image_url: q.image_url,
        order_index: q.order_index,
        options: (byQ[q.id] ?? []).sort((a, b) => a.order_index - b.order_index),
      }));
      setExam({ ...first, questions });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return <AppShell><p className="text-muted-foreground">טוען…</p></AppShell>;
  }

  if (!exam || exam.questions.length === 0) {
    return (
      <AppShell>
        <div className="mx-auto mt-10 max-w-md rounded-3xl border border-dashed border-border/60 bg-card/40 p-8 text-center">
          <FileQuestion className="mx-auto h-10 w-10 text-muted-foreground" />
          <h1 className="mt-3 text-xl font-bold">אין מבחן זמין</h1>
          <p className="mt-2 text-sm text-muted-foreground">המורה טרם פרסם מבחן. חזור מאוחר יותר.</p>
          <Link to="/dashboard" className="mt-5 inline-block text-gold">חזור לדשבורד</Link>
        </div>
      </AppShell>
    );
  }

  const q = exam.questions[i];

  const next = async () => {
    if (picked === null) return;
    const nextAnswers = { ...answers, [q.id]: picked };
    setAnswers(nextAnswers);
    setPicked(null);
    if (i + 1 >= exam.questions.length) {
      // Submit to server for grading
      const { data, error } = await supabase.rpc("grade_exam_attempt", {
        p_exam_id: exam.id,
        p_answers: nextAnswers,
      });
      if (!error && data && data[0]) {
        const row: any = data[0];
        setResult({
          score: row.score,
          total: row.total,
          correctByQuestion: row.correct_by_question ?? {},
        });
      }
      setDone(true);
    } else {
      setI((n) => n + 1);
    }
  };

  const reset = () => { setI(0); setPicked(null); setAnswers({}); setDone(false); setResult(null); };

  if (done && result) {
    const pct = Math.round((result.score / Math.max(result.total, 1)) * 100);
    return (
      <AppShell>
        <div className="mx-auto mt-10 max-w-md rounded-3xl border border-gold/30 bg-gradient-to-br from-amber-900/40 via-card to-card p-8 text-center shadow-[var(--shadow-gold)]">
          <div className="text-xs uppercase tracking-widest text-gold/80">{t("completed")}</div>
          <div className="mt-2 text-6xl font-black text-gradient-gold">{pct}%</div>
          <p className="mt-2 text-sm text-muted-foreground">{result.score} / {result.total}</p>
          <button onClick={reset} className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-gold px-6 py-3 text-sm font-semibold text-gold-foreground">
            <RotateCcw className="h-4 w-4" /> שוב
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black tracking-tight">{exam.title}</h1>
        <span className="text-xs text-muted-foreground">{i + 1} / {exam.questions.length}</span>
      </div>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-card">
        <div className="h-full bg-gradient-to-r from-gold to-amber-500 transition-all" style={{ width: `${(i / exam.questions.length) * 100}%` }} />
      </div>

      <div className="mt-6 rounded-3xl border border-border/70 bg-card/60 p-6 shadow-[var(--shadow-elev)]">
        <p className="text-lg font-semibold leading-snug">{q.question_text}</p>

        <ul className="mt-5 space-y-2">
          {q.options.map((opt) => {
            const isPicked = picked === opt.id;
            return (
              <li key={opt.id}>
                <button
                  onClick={() => setPicked(opt.id)}
                  className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-start text-sm transition ${
                    isPicked ? "border-gold/60 bg-gold/10" : "border-border bg-background/40 hover:border-gold/40"
                  }`}
                >
                  <span>{opt.option_text}</span>
                  {isPicked && <CheckCircle2 className="h-5 w-5 text-gold" />}
                </button>
              </li>
            );
          })}
        </ul>

        <button
          onClick={next}
          disabled={picked === null}
          className="mt-6 w-full rounded-2xl bg-gradient-to-br from-gold to-amber-600 px-6 py-3.5 text-base font-semibold text-gold-foreground shadow-[var(--shadow-gold)] disabled:opacity-40"
        >
          {i + 1 >= exam.questions.length ? "סיום" : "הבא →"}
        </button>
      </div>
      {/* hide unused icon imports lint */}
      <span className="hidden"><XCircle /></span>
    </AppShell>
  );
}
