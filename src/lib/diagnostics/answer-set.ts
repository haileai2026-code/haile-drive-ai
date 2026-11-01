/**
 * Anti-forgery: a submission must answer EXACTLY the session's question set,
 * each question once. Throws on duplicates, unknown ids or missing ids.
 */
export function assertExactQuestionSet(qIds: readonly string[], expected: readonly string[]): void {
  const want = new Set(expected);
  const seen = new Set<string>();
  for (const id of qIds) {
    if (!want.has(id)) throw new Error(`unknown question ${id}`);
    if (seen.has(id)) throw new Error(`duplicate answer for ${id}`);
    seen.add(id);
  }
  if (seen.size !== want.size) throw new Error("incomplete answers");
}
