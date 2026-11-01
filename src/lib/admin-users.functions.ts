import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { likeLiteral } from "@/lib/sql-like";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

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

type ImportResult = {
  email: string;
  full_name: string;
  ok: boolean;
  /** linked = candidate linked to a confirmed account; pending = waiting for email confirmation */
  status?: "linked" | "pending";
  error?: string;
};

/** Exact, case-insensitive auth user lookup (service role RPC, no pagination limit). */
async function findAuthUser(email: string): Promise<{ id: string; confirmed: boolean } | null> {
  const { data, error } = await supabaseAdmin.rpc("admin_find_auth_user", { _email: email });
  if (error) throw new Error(error.message);
  const row = data?.[0];
  return row ? { id: row.id, confirmed: !!row.email_confirmed_at } : null;
}

async function ensureLeadRole(userId: string, email: string, fullName: string): Promise<void> {
  await supabaseAdmin.from("profiles").upsert({ id: userId, email, full_name: fullName, is_active: true });
  const { data: hasRole } = await supabaseAdmin
    .from("user_roles").select("id")
    .eq("user_id", userId).eq("role", "lead").maybeSingle();
  if (!hasRole) await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "lead" });
}

async function requireOwner(
  context: { supabase: SupabaseClient<Database>; userId: string },
  msg: string,
): Promise<void> {
  const { data: roleRow } = await context.supabase
    .from("user_roles").select("role")
    .eq("user_id", context.userId).eq("role", "owner").maybeSingle();
  if (!roleRow) throw new Error(msg);
}

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
    await requireOwner(context, "Only owners can import students");

    const results: ImportResult[] = [];

    for (const s of data.students) {
      const email = s.email.trim().toLowerCase();
      try {
        // Phone-OTP students are not matched here; staff link them with
        // linkCandidateUser. Never add phone-based matching.
        let user = await findAuthUser(email);
        if (!user) {
          const { data: invited, error: invErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
            email,
            { data: { full_name: s.full_name } },
          );
          if (invErr || !invited.user?.id) {
            results.push({ email, full_name: s.full_name, ok: false, error: invErr?.message ?? "no auth user id" });
            continue;
          }
          user = { id: invited.user.id, confirmed: !!invited.user.email_confirmed_at };
        }

        // Already linked to this account -> nothing to do.
        const { data: existCand } = await supabaseAdmin
          .from("candidates").select("id").eq("user_id", user.id).maybeSingle();
        if (existCand) {
          results.push({ email, full_name: s.full_name, ok: false, error: "תלמיד כבר קיים" });
          continue;
        }

        // A previous import left an unlinked row (user_id null) for this
        // email: reuse it instead of inserting a duplicate. candidates.email
        // is written only by staff/server, never by the student.
        const { data: pending } = await supabaseAdmin
          .from("candidates").select("id")
          .is("user_id", null).ilike("email", likeLiteral(email))
          .order("created_at", { ascending: true }).limit(1).maybeSingle();

        // Link ONLY to an account whose email is confirmed.
        const linkId = user.confirmed ? user.id : null;
        if (pending) {
          const { error: updErr } = await supabaseAdmin.from("candidates")
            .update({ user_id: linkId, class_id: data.class_id, full_name: s.full_name })
            .eq("id", pending.id).is("user_id", null);
          if (updErr) {
            results.push({ email, full_name: s.full_name, ok: false, error: updErr.message });
            continue;
          }
        } else {
          const { error: candErr } = await supabaseAdmin.from("candidates").insert({
            full_name: s.full_name, email, user_id: linkId,
            class_id: data.class_id, status: "new_lead", payment_status: "unpaid",
          });
          if (candErr) {
            results.push({ email, full_name: s.full_name, ok: false, error: candErr.message });
            continue;
          }
        }

        if (linkId) await ensureLeadRole(linkId, email, s.full_name);
        results.push({ email, full_name: s.full_name, ok: true, status: linkId ? "linked" : "pending" });
      } catch (e) {
        results.push({ email, full_name: s.full_name, ok: false, error: e instanceof Error ? e.message : "שגיאה" });
      }
    }

    const success = results.filter((r) => r.ok).length;
    return { results, success, failed: results.length - success };
  });

/**
 * Owner-only explicit link of a candidate row to an auth account (e.g. a
 * phone-OTP student, or an import that was pending email confirmation).
 * The account must be confirmed (email or phone) and not linked elsewhere.
 */
export const linkCandidateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ candidate_id: z.string().uuid(), user_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireOwner(context, "Only owners can link students");

    const { data: got, error: uErr } = await supabaseAdmin.auth.admin.getUserById(data.user_id);
    const u = got?.user;
    if (uErr || !u) throw new Error("User not found");
    if (!u.email_confirmed_at && !u.phone_confirmed_at) throw new Error("User has not confirmed email or phone");

    const { data: other } = await supabaseAdmin
      .from("candidates").select("id").eq("user_id", data.user_id).maybeSingle();
    if (other && other.id !== data.candidate_id) throw new Error("User is already linked to another candidate");

    const { data: cand, error: cErr } = await supabaseAdmin
      .from("candidates").select("id,user_id,full_name,email").eq("id", data.candidate_id).maybeSingle();
    if (cErr || !cand) throw new Error("Candidate not found");
    if (cand.user_id && cand.user_id !== data.user_id) throw new Error("Candidate is already linked to another user");

    const { error } = await supabaseAdmin.from("candidates")
      .update({ user_id: data.user_id }).eq("id", data.candidate_id);
    if (error) throw new Error(error.message);
    await ensureLeadRole(data.user_id, u.email ?? cand.email ?? "", cand.full_name);
    return { ok: true };
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
      .from("candidates").select("id,user_id")
      .eq("id", data.candidate_id).maybeSingle();
    if (candErr || !cand) throw new Error(candErr?.message ?? "Candidate not found");

    await supabaseAdmin.from("candidates")
      .update({ payment_status: data.payment_status })
      .eq("id", data.candidate_id);

    // Sync user role: paid -> student, unpaid -> lead.
    // Matched ONLY on the stable link candidates.user_id -> auth.users.id
    // (never on email, which used to be user-editable in profiles).
    if (cand.user_id) {
      const linkedUserId = cand.user_id;
      const newRole = data.payment_status === "paid" ? "student" : "lead";
      const dropRole = data.payment_status === "paid" ? "lead" : "student";
      await supabaseAdmin.from("user_roles")
        .delete().eq("user_id", linkedUserId).eq("role", dropRole);
      const { data: existing } = await supabaseAdmin
        .from("user_roles").select("id")
        .eq("user_id", linkedUserId).eq("role", newRole).maybeSingle();
      if (!existing) {
        await supabaseAdmin.from("user_roles").insert({ user_id: linkedUserId, role: newRole });
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
