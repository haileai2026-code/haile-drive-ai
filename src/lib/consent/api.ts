import { supabase } from "@/integrations/supabase/client";
import { recordMyConsent, withdrawMyConsent } from "./consent.functions";
import { type ConsentLanguage, type ConsentRow } from "./versions";

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
 * Append the user's decision through the server (consents has no client
 * INSERT; channel/evidence/versions are set and checked server-side).
 */
export async function recordConsent(opts: {
  userId: string;
  language: ConsentLanguage;
  partnerTicked: boolean;
  hasPartnerRecord: boolean;
}) {
  await recordMyConsent({
    data: { language: opts.language, partnerTicked: opts.partnerTicked, hasPartnerRecord: opts.hasPartnerRecord },
  });
}

export async function withdrawConsent(
  consentType: "privacy_terms_abroad" | "partner_individual_progress",
  language: ConsentLanguage,
) {
  await withdrawMyConsent({ data: { consent_type: consentType, language } });
}
