// Closed-beta flags for psychological assessments, shared by the UI and the
// server guards. Identical file on fix/beta-no-id-medical-docs and
// fix/sec-beqa-server-insert (so both merge cleanly).
//
// VITE_BETA_PSYCH_ASSESSMENTS   = on  -> /psych-diagnostic, /marvad-simulator
//                                        and their server writes are enabled.
// VITE_BETA_SENSITIVE_FEATURES  = on  -> heart-rate (rPPG) camera diagnostic.
// Both are OFF by default (closed beta). The DB has its own guard
// (app.beta_psych_assessments, see migration 20261101130000).

function readEnv(name: string): string | undefined {
  let raw: string | undefined;
  try {
    raw = (import.meta as { env?: Record<string, string | undefined> }).env?.[name];
  } catch {
    raw = undefined;
  }
  if (!raw && typeof process !== "undefined") raw = process.env?.[name];
  return raw;
}

function on(name: string): boolean {
  const raw = readEnv(name);
  return raw === "on" || raw === "true" || raw === "1";
}

export const PSYCH_ASSESSMENTS_ENABLED: boolean = on("VITE_BETA_PSYCH_ASSESSMENTS");
export const HEART_RATE_CAMERA_ENABLED: boolean = on("VITE_BETA_SENSITIVE_FEATURES");

export const PSYCH_ASSESSMENTS_DISABLED_MESSAGE = "לא זמין בגרסת הבטא · Not available in the beta";

/** Routes blocked while psych assessments are off. */
export const PSYCH_ASSESSMENT_ROUTES = ["/psych-diagnostic", "/marvad-simulator"] as const;

export function isPsychAssessmentRoute(pathname: string): boolean {
  return PSYCH_ASSESSMENT_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));
}

/** Server guard: call first thing in every psych / BEQA write handler. */
export function assertPsychAssessmentsEnabled(opts: { heartRate?: boolean } = {}): void {
  if (!PSYCH_ASSESSMENTS_ENABLED) throw new Error(PSYCH_ASSESSMENTS_DISABLED_MESSAGE);
  if (opts.heartRate && !HEART_RATE_CAMERA_ENABLED) throw new Error(PSYCH_ASSESSMENTS_DISABLED_MESSAGE);
}
