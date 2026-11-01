// Server-side only: log the database error CODE and CONSTRAINT name (never the
// full message / details, which can contain row values), return a generic
// error to the client (no table / constraint / column names leak).
export const DIAG_SAVE_ERROR = "Could not save the diagnostic";

export function errorSummary(err: unknown): { code: string | null; constraint: string | null } {
  const e = (err ?? {}) as { code?: unknown; message?: unknown; constraint?: unknown };
  const code = typeof e.code === "string" ? e.code : null;
  let constraint = typeof e.constraint === "string" ? e.constraint : null;
  if (!constraint && typeof e.message === "string") {
    constraint = /constraint "([A-Za-z0-9_]{1,63})"/.exec(e.message)?.[1] ?? null;
  }
  return { code, constraint };
}

export function failSave(tag: string, err: unknown): never {
  console.error(`[${tag}]`, errorSummary(err));
  throw new Error(DIAG_SAVE_ERROR);
}
