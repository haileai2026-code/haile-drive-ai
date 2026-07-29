import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { phoneToEmail, normalizePhone } from "./sms/config";

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function hashOtp(otp: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(otp));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateTempPassword(): string {
  // 16 url-safe chars; user never sees this, used internally for signInWithPassword
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 24);
}

async function assertOwnerOrStaff(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["owner", "staff"])
    .maybeSingle();
  if (!data) throw new Error("Forbidden");
}

// Step 1 — student requests an OTP. Anonymous-callable.
export const requestPhoneOtp = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ phone: z.string().min(6).max(40) }).parse(input),
  )
  .handler(async ({ data }) => {
    const phone = normalizePhone(data.phone);
    if (phone.length < 6) throw new Error("מספר טלפון לא תקין");

    const otp = generateOtp();

    const { data: inserted, error } = await supabaseAdmin
      .from("phone_login_requests")
      .insert({
        phone,
        otp_hash: await hashOtp(otp),
        otp_plain: otp,
        status: "pending",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    // The raw code is visible only to owner/staff in the admin screen.
    return { ok: true, request_id: inserted.id };
  });

// Step 2 — student submits OTP. If approved → create / sign in user.
export const verifyPhoneOtp = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({
      phone: z.string().min(6).max(40),
      otp: z.string().regex(/^\d{6}$/),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const phone = normalizePhone(data.phone);

    const { data: req, error } = await supabaseAdmin
      .from("phone_login_requests")
      .select("id, status, otp_hash, expires_at")
      .eq("phone", phone)
      .eq("otp_hash", await hashOtp(data.otp))
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!req) throw new Error("קוד שגוי");
    if (new Date(req.expires_at).getTime() < Date.now()) {
      throw new Error("הקוד פג תוקף");
    }
    if (req.status === "rejected") throw new Error("הבקשה נדחתה");
    if (req.status === "pending") throw new Error("ממתין לאישור מנהל");
    if (req.status === "used") throw new Error("הקוד כבר נוצל");
    if (req.status !== "approved") throw new Error("בקשה לא תקינה");

    // Provision auth user if missing, then set a known temp password so the
    // client can complete sign-in with signInWithPassword.
    const email = phoneToEmail(phone);
    const tempPassword = generateTempPassword();

    // Try to find existing user
    let userId: string | null = null;
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const existing = list?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());

    if (existing) {
      userId = existing.id;
      const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: tempPassword,
        email_confirm: true,
      });
      if (updErr) throw new Error(updErr.message);
    } else {
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { phone, full_name: `סטודנט ${phone.slice(-4)}` },
      });
      if (createErr) throw new Error(createErr.message);
      userId = created.user!.id;

      // Ensure profile + student role
      await supabaseAdmin.from("profiles").upsert({
        id: userId,
        email,
        phone,
        full_name: `סטודנט ${phone.slice(-4)}`,
        is_active: true,
      });
      await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
      await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "student" });
    }

    await supabaseAdmin
      .from("phone_login_requests")
      .update({ status: "used", user_id: userId })
      .eq("id", req.id);

    return { ok: true, email, password: tempPassword };
  });

// Owner approves a pending phone login request.
export const approvePhoneRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertOwnerOrStaff(context.supabase, context.userId);
    const { error } = await supabaseAdmin
      .from("phone_login_requests")
      .update({ status: "approved" })
      .eq("id", data.id)
      .eq("status", "pending");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const rejectPhoneRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertOwnerOrStaff(context.supabase, context.userId);
    const { error } = await supabaseAdmin
      .from("phone_login_requests")
      .update({ status: "rejected" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listPhoneRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwnerOrStaff(context.supabase, context.userId);
    const { data, error } = await supabaseAdmin
      .from("phone_login_requests")
      .select("id, phone, status, created_at, expires_at, otp_plain")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return { rows: data ?? [] };
  });
