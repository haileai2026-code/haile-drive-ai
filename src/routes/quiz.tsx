import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { sampleQuestions } from "@/lib/mock-data";
import { CheckCircle2, XCircle, RotateCcw } from "lucide-react";

export const Route = createFileRoute("/quiz")({
  head: () => ({ meta: [{ title: "Quiz — Haile Drive AI" }] }),
  component: QuizPage,
});

function QuizPage() {
  const { t, lang } = useI18n();
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  const q = sampleQuestions[i];
  const correct = picked === q.correct;

  const next = () => {
    if (picked === null) return;
    if (correct) setScore((s) => s + 1);
    setPicked(null);
    if (i + 1 >= sampleQuestions.length) setDone(true);
    else setI((n) => n + 1);
  };

  const reset = () => { setI(0); setPicked(null); setScore(0); setDone(false); };

  if (done) {
    const pct = Math.round((score / sampleQuestions.length) * 100);
    return (
      <AppShell>
        <div className="mx-auto mt-10 max-w-md rounded-3xl border border-gold/30 bg-gradient-to-br from-amber-900/40 via-card to-card p-8 text-center shadow-[var(--shadow-gold)]">
          <div className="text-xs uppercase tracking-widest text-gold/80">{t("completed")}</div>
          <div className="mt-2 text-6xl font-black text-gradient-gold">{pct}%</div>
          <p className="mt-2 text-sm text-muted-foreground">{score} / {sampleQuestions.length}</p>
          <button onClick={reset} className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-gold px-6 py-3 text-sm font-semibold text-gold-foreground">
            <RotateCcw className="h-4 w-4" /> Retry
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black tracking-tight">{t("quiz")}</h1>
        <span className="text-xs text-muted-foreground">{i + 1} / {sampleQuestions.length}</span>
      </div>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-card">
        <div className="h-full bg-gradient-to-r from-gold to-amber-500 transition-all" style={{ width: `${((i) / sampleQuestions.length) * 100}%` }} />
      </div>

      <div className="mt-6 rounded-3xl border border-border/70 bg-card/60 p-6 shadow-[var(--shadow-elev)]">
        <p className="text-lg font-semibold leading-snug">{q.q[lang]}</p>

        <ul className="mt-5 space-y-2">
          {q.options.map((opt, idx) => {
            const isPicked = picked === idx;
            const showCorrect = picked !== null && idx === q.correct;
            const showWrong = isPicked && idx !== q.correct;
            return (
              <li key={idx}>
                <button
                  disabled={picked !== null}
                  onClick={() => setPicked(idx)}
                  className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-start text-sm transition ${
                    showCorrect ? "border-success/60 bg-success/15 text-success-foreground" :
                    showWrong ? "border-destructive/60 bg-destructive/15" :
                    isPicked ? "border-gold/60 bg-gold/10" : "border-border bg-background/40 hover:border-gold/40"
                  }`}
                >
                  <span>{opt[lang]}</span>
                  {showCorrect && <CheckCircle2 className="h-5 w-5 text-success" />}
                  {showWrong && <XCircle className="h-5 w-5 text-destructive" />}
                </button>
              </li>
            );
          })}
        </ul>

        {picked !== null && (
          <div className={`mt-5 rounded-2xl border p-4 text-sm ${correct ? "border-success/40 bg-success/10" : "border-destructive/40 bg-destructive/10"}`}>
            <div className="font-semibold">{correct ? "✓" : "✗"} {q.explain[lang]}</div>
          </div>
        )}

        <button
          onClick={next}
          disabled={picked === null}
          className="mt-6 w-full rounded-2xl bg-gradient-to-br from-gold to-amber-600 px-6 py-3.5 text-base font-semibold text-gold-foreground shadow-[var(--shadow-gold)] disabled:opacity-40"
        >
          {i + 1 >= sampleQuestions.length ? "Finish" : "Next →"}
        </button>
      </div>
    </AppShell>
  );
}
