import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildWebEvidence, clientIpFrom } from "./evidence";
import {
  CHECKBOX_VERSION,
  NOTICE_VERSION,
  PARTNER_CHECKBOX_VERSION,
  TERMS_VERSION,
  checkboxVersionFor,
  type ConsentLanguage,
} from "./versions";

const LANG = z.enum(["he", "am", "ru"]);

async function webEvidence() {
  const headers = getRequest()?.headers ?? new Headers();
  return buildWebEvidence(clientIpFrom(headers), headers.get("user-agent"), process.env.CONSENT_EVIDENCE_PEPPER);
}

function rowFor(type: "privacy_terms_abroad" | "partner_individual_progress", granted: boolean, lang: ConsentLanguage) {
  return type === "privacy_terms_abroad"
    ? { p_consent_type: type, p_granted: granted, p_notice_version: NOTICE_VERSION, p_terms_version: TERMS_VERSION,
        p_checkbox_version: checkboxVersionFor(CHECKBOX_VERSION, lang), p_language: lang }
    : { p_consent_type: type, p_granted: granted, p_notice_version: NOTICE_VERSION, p_terms_version: null,
        p_checkbox_version: checkboxVersionFor(PARTNER_CHECKBOX_VERSION, lang), p_language: lang };
}

async function insert(userId: string, row: ReturnType<typeof rowFor>, evidence: Awaited<ReturnType<typeof webEvidence>>) {
  const { error } = await supabaseAdmin.rpc("record_consent", {
    p_user_id: userId, p_subject_candidate_id: null, p_channel: "web", p_evidence: evidence, ...row,
  });
  if (error) throw new Error("consent could not be recorded");
}

/**
 * Record the consent form. Checkbox 1 always (granted=true). Checkbox 2 on the
 * first decision (true/false) and afterwards only when ticked, so re-accepting
 * a new notice version never silently withdraws partner sharing.
 */
export const recordMyConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ language: LANG, partnerTicked: z.boolean(), hasPartnerRecord: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const ev = await webEvidence();
    await insert(context.userId, rowFor("privacy_terms_abroad", true, data.language), ev);
    if (data.partnerTicked || !data.hasPartnerRecord) {
      await insert(context.userId, rowFor("partner_individual_progress", data.partnerTicked, data.language), ev);
    }
    return { ok: true };
  });

/** Withdrawal = a new row with granted=false (history is never changed). */
export const withdrawMyConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ consent_type: z.enum(["privacy_terms_abroad", "partner_individual_progress"]), language: LANG }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await insert(context.userId, rowFor(data.consent_type, false, data.language), await webEvidence());
    return { ok: true };
  });
