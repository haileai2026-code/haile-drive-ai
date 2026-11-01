// Server-side grading of the psychological diagnostic. Import ONLY from
// server function handlers (beqa-submit.functions.ts); it pulls in the
// answer key (scoring.ts).
import { PSYCH_QUESTIONS } from "./psych-questions";
import { scoreFor } from "./scoring";

// Score weights per spec
export function calcScore(answers: Record<string, number>): number {
  const get = (id: string) => answers[id] ?? 0;
  const avg = (ids: string[]) => {
    const vals = ids.map(get).filter((v) => v > 0);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  };
  const motivation = avg(["q1", "q5", "q8"]);
  const selfControl = avg(["q2", "qp"]);
  const safety = avg(["q3", "q4"]);
  const communication = avg(["q7", "q10"]);
  const stability = avg(["q6", "q9"]);
  const score =
    motivation * 0.25 +
    selfControl * 0.25 +
    safety * 0.20 +
    communication * 0.15 +
    stability * 0.15;
  return Math.round(score * 100) / 100;
}

export function recommendationFor(score: number): { letter: "A" | "B" | "C"; label: string } {
  if (score >= 4.0) return { letter: "A", label: "מומלץ מאוד להמשך תהליך" };
  if (score >= 3.0) return { letter: "B", label: "מומלץ ראיון נוסף" };
  return { letter: "C", label: "לא מומלץ כרגע" };
}

/**
 * `picks` maps question id -> chosen option index. Exactly the bank's
 * question set is required; unknown ids and out-of-range indices are rejected.
 */
export function gradePsych(picks: Record<string, number>) {
  const byId = new Map(PSYCH_QUESTIONS.map((q) => [q.id, q]));
  const final: Record<string, number> = {};
  for (const [qId, idx] of Object.entries(picks)) {
    const q = byId.get(qId);
    if (!q) throw new Error(`unknown question ${qId}`);
    if (!Number.isInteger(idx) || idx < 0 || idx >= q.options.length) throw new Error(`invalid option for ${qId}`);
    const score = scoreFor(qId, idx);
    if (score <= 0) throw new Error(`no score for ${qId}`);
    final[qId] = score;
  }
  if (Object.keys(final).length !== PSYCH_QUESTIONS.length) throw new Error("incomplete answers");
  const score = calcScore(final); // 1-4 scale
  const rec = recommendationFor(score);
  // Normalize to 0-100 scale for unified scoring/reporting
  const psychological100 = Math.round((score / 4) * 1000) / 10;
  const vals = Object.values(final);
  const accuracy100 = vals.length
    ? Math.round((vals.filter((v) => v >= 3).length / vals.length) * 1000) / 10
    : 0;
  // Without biometric data, final BEQA = psychological * 0.7 + accuracy * 0.3
  const finalBeqa = Math.round((psychological100 * 0.7 + accuracy100 * 0.3) * 10) / 10;
  return { final, score, rec, psychological100, accuracy100, finalBeqa };
}
