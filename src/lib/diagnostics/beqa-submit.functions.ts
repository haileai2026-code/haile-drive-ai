import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { gradePsych } from "./psych-questions";
import {
  INTERVIEW,
  MMPI_MAX,
  MMPI_QUESTIONS,
  interviewFromPicks,
  mmpiFromPicks,
} from "./marvad-scoring";

// Server-side grading + storage for BEQA sessions (plan C2).
// Students have no INSERT/UPDATE grant on beqa_diagnostic_sessions; these
// handlers authenticate the caller, check BEQA access with the caller's own
// client, recompute every official score on the server and insert with the
// service role. Exception: the Marvad simulator is practice-only; its score is
// never sent to or stored on the server (raw measurements only, no score).
// Nothing score-related is returned to the client.

export const submitPsychDiagnostic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        community: z.enum(["ethiopian", "russian", "manashe"]),
        picks: z.record(z.string().min(1).max(16), z.number().int().min(0).max(8)),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: access, error: accessErr } = await context.supabase.rpc(
      "current_user_has_beqa_access",
    );
    if (accessErr) throw new Error("BEQA access check failed");
    if (access !== true) throw new Error("No BEQA access");

    const g = gradePsych(data.community, data.picks);
    const { error } = await supabaseAdmin.from("beqa_diagnostic_sessions").insert({
      student_id: context.userId,
      assessment_type: "psychological",
      community_type: data.community,
      psychological_score: g.psychological100,
      accuracy_score: g.accuracy100,
      final_beqa_score: g.finalBeqa,
      recommendation: g.rec.letter,
      answers: g.final,
      end_time: new Date().toISOString(),
      metadata: {
        recommendation_label: g.rec.label,
        version: "psych-v2",
        raw_score_1_4: g.score,
        graded: "server",
      },
    });
    if (error) throw new Error("Could not save the diagnostic");
    return { ok: true as const };
  });

export const submitMarvadSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        mmpiPicks: z.array(z.number().int().min(0).max(8)).length(MMPI_QUESTIONS.length),
        interviewPicks: z.array(z.number().int().min(0).max(8)).length(INTERVIEW.length),
        cpt: z
          .object({
            rtMean: z.number().min(0).max(10_000),
            rtSd: z.number().min(0).max(10_000),
            omissions: z.number().int().min(0).max(50),
            commissions: z.number().int().min(0).max(50),
          })
          .nullable(),
        atavtTrials: z.array(z.number().min(0).max(100)).max(50),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: access, error: accessErr } = await context.supabase.rpc(
      "current_user_has_beqa_access",
    );
    if (accessErr) throw new Error("BEQA access check failed");
    if (access !== true) throw new Error("No BEQA access");

    const mmpi = mmpiFromPicks(data.mmpiPicks);
    const interview = interviewFromPicks(data.interviewPicks);
    const cpt = data.cpt;
    const atavtTrials = data.atavtTrials.map((s) => Math.round(s));
    // CTO decision: the Marvad simulator score is a PRACTICE score only. It is
    // computed client-side for the practice results screen and is never sent
    // to or stored on the server, and it never counts toward the official BEQA
    // score. We store only the raw measurements (no score columns), so every
    // consumer that filters on final_beqa_score IS NOT NULL (readiness score,
    // dashboard, admin, history) ignores these rows.
    // TODO(post-go-live): storing raw practice (Marvad) measurements without a
    // score is accepted for the closed beta (CTO decision). Revisit after
    // go-live: keep, minimise or stop storing these raw practice measurements.
    const { error } = await supabaseAdmin.from("beqa_diagnostic_sessions").insert({
      student_id: context.userId,
      assessment_type: "marvad_simulator",
      psychological_score: null,
      accuracy_score: null,
      final_beqa_score: null,
      end_time: new Date().toISOString(),
      metadata: {
        practice: true,
        counts_toward_official_score: false,
        rt_mean: cpt?.rtMean ?? null,
        rt_sd: cpt?.rtSd ?? null,
        omissions: cpt?.omissions ?? 0,
        commissions: cpt?.commissions ?? 0,
        atavt_trials: atavtTrials,
        mmpi_lie_flag: mmpi.lieFlag,
        interview_notes: interview.notes,
        graded: "none (practice)",
      },
    });
    if (error) throw new Error("Could not save the session");
    return { ok: true as const };
  });
