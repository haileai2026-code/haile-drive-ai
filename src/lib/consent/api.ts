import { supabase } from "@/integrations/supabase/client";
import {
  CHECKBOX_VERSION,
  NOTICE_VERSION,
  PARTNER_CHECKBOX_VERSION,
  TERMS_VERSION,
  checkboxVersionFor,
  type ConsentLanguage,
  type ConsentRow,
} from "./versions";

const COLS = "consent_type, granted, notice_version, terms_version, checkbox_version";

async function latest(userId: string, type: string): Promise<ConsentRow | null> {
  const { data, error } = await supabase
    .from("consents")
    .select(COLS)
    .eq("user_id", userId)
    .eq("consent_type", type)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ConsentRow | null) ?? null;
}

export async function fetchConsentState(userId: string) {
  const [required, partner] = await Promise.all([
    latest(userId, "privacy_terms_abroad"),
    latest(userId, "partner_individual_progress"),
  ]);
  return { required, partner };
}

/**
 * Append the user's decision. Checkbox 1 is always recorded (granted=true).
 * Checkbox 2 is recorded on the first decision (true/false) and afterwards
 * only when ticked, so re-accepting a new notice version never silently
 * withdraws an earlier partner consent. Withdrawal is a separate action.
 */
export async function recordConsent(opts: {
  userId: string;
  language: ConsentLanguage;
  partnerTicked: boolean;
  hasPartnerRecord: boolean;
}) {
  const rows: Array<{
    user_id: string;
    consent_type: string;
    granted: boolean;
    notice_version: string;
    terms_version: string | null;
    checkbox_version: string;
    language: string;
  }> = [
    {
      user_id: opts.userId,
      consent_type: "privacy_terms_abroad",
      granted: true,
      notice_version: NOTICE_VERSION,
      terms_version: TERMS_VERSION,
      checkbox_version: checkboxVersionFor(CHECKBOX_VERSION, opts.language),
      language: opts.language,
    },
  ];
  if (opts.partnerTicked || !opts.hasPartnerRecord) {
    rows.push({
      user_id: opts.userId,
      consent_type: "partner_individual_progress",
      granted: opts.partnerTicked,
      notice_version: NOTICE_VERSION,
      terms_version: null,
      checkbox_version: checkboxVersionFor(PARTNER_CHECKBOX_VERSION, opts.language),
      language: opts.language,
    });
  }
  const { error } = await supabase.from("consents").insert(rows);
  if (error) throw new Error(error.message);
}
