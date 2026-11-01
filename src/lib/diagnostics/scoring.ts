/**
 * Option scores by question id (single bank: q1-q10 + qp; per-community
 * banks removed, CTO gate 5). Server-only: imported only by server function
 * handlers / psych-grading.ts, never by client routes.
 */
export const OPTION_SCORES: Record<string, number[]> = {
  q1: [1, 2, 4, 3],
  q2: [1, 2, 4, 3],
  q3: [1, 2, 4, 4],
  q4: [1, 2, 4, 2],
  q5: [1, 2, 3, 4],
  q6: [1, 2, 3, 4],
  q7: [1, 2, 3, 4],
  q8: [1, 2, 3, 4],
  q9: [1, 2, 3, 4],
  q10: [2, 4, 4, 3],
  qp: [1, 2, 4, 2],
};

export function scoreFor(qId: string, optionIndex: number): number {
  const row = OPTION_SCORES[qId];
  if (!row || optionIndex < 0 || optionIndex >= row.length) return 0;
  return row[optionIndex];
}
