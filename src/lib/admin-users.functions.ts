import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const createUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      email: z.string().email(),
      password: z.string().min(8).max(72),
      full_name: z.string().min(1).max(120),
      phone: z.string().max(40).optional().nullable(),
      role: z.enum(["teacher", "student", "staff"]).default("teacher"),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    // Verify caller is owner
    const { data: roleRow } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "owner")
      .maybeSingle();
    if (!roleRow) throw new Error("Only owners can create users");

    // Create auth user (auto-confirm)
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name, phone: data.phone ?? "" },
    });
    if (error) throw new Error(error.message);
    const newId = created.user!.id;

    const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
      id: newId,
      email: data.email,
      full_name: data.full_name,
      phone: data.phone ?? "",
      is_active: true,
    });
    if (profileError) throw new Error(profileError.message);

    await supabaseAdmin.from("user_roles").delete().eq("user_id", newId);
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newId, role: data.role });
    if (roleError) throw new Error(roleError.message);

    return { id: newId };
  });

export const importStudents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      class_id: z.string().uuid(),
      students: z.array(z.object({
        full_name: z.string().min(1).max(200),
        email: z.string().email().max(255),
      })).min(1).max(500),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: roleRow } = await context.supabase
      .from("user_roles").select("role")
      .eq("user_id", context.userId).eq("role", "owner").maybeSingle();
    if (!roleRow) throw new Error("Only owners can import students");

    const results: { email: string; full_name: string; ok: boolean; error?: string }[] = [];

    for (const s of data.students) {
      try {
        // check existing candidate by email
        const { data: existCand } = await supabaseAdmin
          .from("candidates").select("id").ilike("email", s.email).maybeSingle();
        if (existCand) {
          results.push({ email: s.email, full_name: s.full_name, ok: false, error: "אימייל כבר קיים" });
          continue;
        }

        // invite via auth (creates user + sends email)
        let userId: string | null = null;
        const { data: invited, error: invErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
          s.email,
          { data: { full_name: s.full_name } },
        );
        if (invErr) {
          // user may already exist in auth — try to look up
          const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
          const found = list?.users?.find((u) => u.email?.toLowerCase() === s.email.toLowerCase());
          if (found) {
            userId = found.id;
          } else {
            results.push({ email: s.email, full_name: s.full_name, ok: false, error: invErr.message });
            continue;
          }
        } else {
          userId = invited.user?.id ?? null;
        }

        if (userId) {
          await supabaseAdmin.from("profiles").upsert({
            id: userId, email: s.email, full_name: s.full_name, is_active: true,
          });
          const { data: hasRole } = await supabaseAdmin
            .from("user_roles").select("id")
            .eq("user_id", userId).eq("role", "lead").maybeSingle();
          if (!hasRole) {
            await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "lead" });
          }
        }

        const { error: candErr } = await supabaseAdmin.from("candidates").insert({
          full_name: s.full_name, email: s.email, class_id: data.class_id, status: "new_lead", payment_status: "unpaid",
        });
        if (candErr) {
          results.push({ email: s.email, full_name: s.full_name, ok: false, error: candErr.message });
          continue;
        }

        results.push({ email: s.email, full_name: s.full_name, ok: true });
      } catch (e: any) {
        results.push({ email: s.email, full_name: s.full_name, ok: false, error: e.message ?? "שגיאה" });
      }
    }

    const success = results.filter((r) => r.ok).length;
    return { results, success, failed: results.length - success };
  });

export const setCandidatePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      candidate_id: z.string().uuid(),
      payment_status: z.enum(["unpaid", "paid", "partial"]),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: roleRow } = await context.supabase
      .from("user_roles").select("role")
      .eq("user_id", context.userId).eq("role", "owner").maybeSingle();
    if (!roleRow) throw new Error("Only owners can change payment status");

    const { data: cand, error: candErr } = await supabaseAdmin
      .from("candidates").select("id,email")
      .eq("id", data.candidate_id).maybeSingle();
    if (candErr || !cand) throw new Error(candErr?.message ?? "Candidate not found");

    await supabaseAdmin.from("candidates")
      .update({ payment_status: data.payment_status })
      .eq("id", data.candidate_id);

    // Sync user role: paid -> student, unpaid -> lead
    if (cand.email) {
      const { data: profile } = await supabaseAdmin
        .from("profiles").select("id").ilike("email", cand.email).maybeSingle();
      if (profile) {
        const newRole = data.payment_status === "paid" ? "student" : "lead";
        const dropRole = data.payment_status === "paid" ? "lead" : "student";
        await supabaseAdmin.from("user_roles")
          .delete().eq("user_id", profile.id).eq("role", dropRole);
        const { data: existing } = await supabaseAdmin
          .from("user_roles").select("id")
          .eq("user_id", profile.id).eq("role", newRole).maybeSingle();
        if (!existing) {
          await supabaseAdmin.from("user_roles").insert({ user_id: profile.id, role: newRole });
        }
      }
    }

    return { ok: true };
  });

export const setCandidateBeqaAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      candidate_id: z.string().uuid(),
      beqa_access: z.boolean(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: roleRow } = await context.supabase
      .from("user_roles").select("role")
      .eq("user_id", context.userId).eq("role", "owner").maybeSingle();
    if (!roleRow) throw new Error("Only owners can change BEQA access");

    const { error } = await supabaseAdmin.from("candidates")
      .update({ beqa_access: data.beqa_access })
      .eq("id", data.candidate_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
