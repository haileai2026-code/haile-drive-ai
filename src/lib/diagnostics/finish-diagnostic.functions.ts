import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { assertPsychAssessmentsEnabled } from "@/lib/psych-assessments-flag";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireCurrentConsent } from "@/lib/consent/enforce.server";
import { calculateBeqaScore } from "@/lib/beqa-questions";
import { scoreFor } from "./scoring";
import { assertExactQuestionSet } from "./answer-set";
import { DIAG_QUESTION_IDS } from "./questions";
import { failSave } from "./save-error";

const AnswerIn = z.object({
  qId: z.string().min(1).max(16),
  optionIndex: z.number().int().min(0).max(8),
  rtMs: z.number().int().min(0).max(120_000),
  bpm: z.number().nullable(),
  hrv: z.number().nullable(),
});

export const finishDiagnostic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireCurrentConsent])
  .inputValidator((input: unknown) =>
    z
      .object({
        // Display language only (CTO gate 5: no community / ethnic field).
        language: z.enum(["he", "am", "ru"]),
        sessionId: z.string().uuid(),
        baselineHr: z.number().nullable(),
        stressHr: z.number().nullable(),
        answers: z.array(AnswerIn).min(1).max(20),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    assertPsychAssessmentsEnabled({ heartRate: true }); // closed beta: off by default
    // Gate with the caller's own client (auth.uid() = caller), then write with
    // the service role: students have no INSERT grant on beqa_diagnostic_sessions.
    const { data: access, error: accessErr } = await context.supabase.rpc("current_user_has_beqa_access");
    if (accessErr) throw new Error("BEQA access check failed");
    if (access !== true) throw new Error("No BEQA access");

    // The session's question set is the single bank: every id exactly once.
    assertExactQuestionSet(data.answers.map((a) => a.qId), DIAG_QUESTION_IDS);

    const scored = data.answers.map((a) => ({
      ...a,
      score: scoreFor(a.qId, a.optionIndex),
    }));
    const correct = scored.filter((a) => a.score >= 3).length;
    const breakdown = calculateBeqaScore({
      correctAnswers: correct,
      totalQuestions: scored.length,
      baselineHr: data.baselineHr ?? 72,
      stressHr: data.stressHr ?? data.baselineHr ?? 72,
      reactionTimesMs: scored.map((a) => a.rtMs),
    });

    const answersMap: Record<string, number> = {};
    for (const a of scored) answersMap[a.qId] = a.optionIndex;

    const { error } = await supabaseAdmin.from("beqa_diagnostic_sessions").insert({
      student_id: context.userId,
      assessment_type: "unified",
      // community_type is no longer written (column kept; not dropped here)
      answers: answersMap,
      accuracy_score: breakdown.accuracy,
      final_beqa_score: breakdown.beqa,
      baseline_hr: data.baselineHr,
      stress_hr: data.stressHr,
      end_time: new Date().toISOString(),
      metadata: {
        version: "prd-0.4-0.3-0.3",
        language: data.language,
        provider: "inhouse",
        stability: breakdown.stability,
        reaction: breakdown.reaction,
        reaction_sd_ms: breakdown.reactionSdMs,
      },
    });
    if (error) failSave("finishDiagnostic insert", error);

    const clicks = scored.map((a) => ({
      session_id: data.sessionId,
      student_id: context.userId,
      bpm: a.bpm,
      hrv: a.hrv,
      signal_quality: a.bpm ? "medium" : "none",
      reaction_ms: a.rtMs,
      provider: "inhouse",
    }));
    // Server client: students have no INSERT grant on beqa_pulse_clicks.
    const { error: clickErr } = await supabaseAdmin.from("beqa_pulse_clicks").insert(clicks);
    if (clickErr) console.error("[beqa_pulse_clicks]", clickErr.code);

    return { ok: true as const };
  });
