/** Option scores by question id. Server-only — never import from client routes. */
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
  qe1: [1, 2, 4],
  qe2: [1, 2, 4],
  qe3: [1, 3, 4],
  qr1: [1, 2, 4],
  qr2: [1, 2, 4],
  qr3: [1, 2, 4],
  qm1: [2, 2, 4],
  qm2: [1, 2, 4],
  qm3: [1, 2, 4],
};

export function scoreFor(qId: string, optionIndex: number): number {
  const row = OPTION_SCORES[qId];
  if (!row || optionIndex < 0 || optionIndex >= row.length) return 0;
  return row[optionIndex];
}
