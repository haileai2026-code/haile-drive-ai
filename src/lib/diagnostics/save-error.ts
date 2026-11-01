// Server-side only: log the full database error, return a generic one to the
// client (no table / constraint / column names leak to the browser).
export const DIAG_SAVE_ERROR = "Could not save the diagnostic";

export function failSave(tag: string, err: unknown): never {
  console.error(`[${tag}]`, err);
  throw new Error(DIAG_SAVE_ERROR);
}
