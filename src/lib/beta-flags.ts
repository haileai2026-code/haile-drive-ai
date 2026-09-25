// Closed-beta feature flag.
//
// BETA_SENSITIVE_FEATURES = false (default) HIDES, for the closed beta:
//   - ID / medical document upload UI and the national-ID field
//   - the heart-rate (rPPG) camera diagnostic
//   - the BEQA/psych score in the student UI
//   - outbound SMS / WhatsApp (Twilio) and Twilio phone-OTP login
// Hide only: no code, data or DB objects are removed.
//
// To turn the features back on, set VITE_BETA_SENSITIVE_FEATURES=on in the
// runtime/build env (read here in code; no build-config change needed).
// ElevenLabs (TTS) and Daily (live classes, recording off) are NOT affected.

function readFlag(): boolean {
  let raw: string | undefined;
  try {
    raw = (import.meta as { env?: Record<string, string | undefined> }).env
      ?.VITE_BETA_SENSITIVE_FEATURES;
  } catch {
    raw = undefined;
  }
  if (!raw && typeof process !== "undefined") {
    raw = process.env?.VITE_BETA_SENSITIVE_FEATURES;
  }
  return raw === "on" || raw === "true" || raw === "1";
}

export const BETA_SENSITIVE_FEATURES: boolean = readFlag();

export const BETA_FEATURES = {
  idMedicalDocuments: BETA_SENSITIVE_FEATURES,
  heartRateCamera: BETA_SENSITIVE_FEATURES,
  studentPsychScore: BETA_SENSITIVE_FEATURES,
  outboundMessaging: BETA_SENSITIVE_FEATURES,
  phoneOtpLogin: BETA_SENSITIVE_FEATURES,
} as const;

export const BETA_DISABLED_MESSAGE = "לא זמין בגרסת הבטא · Not available in the beta";

export const PHONE_LOGIN_DISABLED = "כניסה בטלפון אינה זמינה בגרסת הבטא — יש להיכנס עם אימייל";
