// Consent version constants (Campus Privacy Notice FINAL DRAFT v0.4, §0.1).
// Changing NOTICE_VERSION, TERMS_VERSION or CHECKBOX_VERSION re-prompts every
// student for the required checkbox (ConsentGate). Changing
// PARTNER_CHECKBOX_VERSION makes the optional partner sharing count as NOT
// granted until re-ticked, without blocking the app.
// STATUS: DRAFT text (awaiting approval) - see content.he.ts.

export const NOTICE_VERSION = "campus-privacy-v0.4";
export const TERMS_VERSION = "campus-terms-beta-v0.4";
export const CHECKBOX_VERSION = "campus-consent-v0.3"; // checkbox 1 (required)
export const PARTNER_CHECKBOX_VERSION = "campus-consent-partner-v0.3"; // checkbox 2 (optional)
// Checkbox 3 (campus-consent-employer-v0.3) is defined in the notice but hidden in the beta.

export type ConsentLanguage = "he" | "am" | "ru";
export type ConsentType = "privacy_terms_abroad" | "partner_individual_progress" | "share_employer";

/** Checkbox text version as stored: "<base>-<lang>", e.g. campus-consent-v0.3-he */
export function checkboxVersionFor(base: string, lang: ConsentLanguage): string {
  return `${base}-${lang}`;
}

export type ConsentRow = {
  consent_type: string;
  granted: boolean;
  notice_version: string;
  terms_version: string | null;
  checkbox_version: string;
};

/** True when the latest checkbox-1 record is missing, withdrawn or for an older version. */
export function needsRequiredConsent(latest: ConsentRow | null | undefined): boolean {
  if (!latest || !latest.granted) return true;
  return (
    latest.notice_version !== NOTICE_VERSION ||
    latest.terms_version !== TERMS_VERSION ||
    !latest.checkbox_version.startsWith(`${CHECKBOX_VERSION}-`)
  );
}

/** Partner sharing is effective only if the latest record is granted for the current text version. */
export function partnerSharingGranted(latest: ConsentRow | null | undefined): boolean {
  return !!latest && latest.granted && latest.checkbox_version.startsWith(`${PARTNER_CHECKBOX_VERSION}-`);
}
