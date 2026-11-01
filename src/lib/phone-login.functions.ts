import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getRequest } from "@tanstack/react-start/server";
import { phoneToEmail } from "./sms/config";
import { normalizePhoneE164, phoneEmailCandidates } from "./phone";
import { sendViaTwilio } from "./notifications.functions";
import {
  OTP_GENERIC_MESSAGE,
  OTP_LOCKED_MESSAGE,
  OTP_REQUEST_GENERIC_MESSAGE,
  generateOtp,
  hashIp,
  hashOtp,
  otpOutcomeMessage,
} from "./otp";

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

function clientIp(): string | null {
  const h = getRequest()?.headers;
  const xff = h?.get("x-forwarded-for")?.split(",")[0]?.trim();
  return xff || h?.get("x-real-ip")?.trim() || null;
}

// Step 1 — student requests an OTP. Anonymous-callable. CAPTCHA is a noted
// follow-up; until then the per-phone, per-IP and global hourly limits in
// public.phone_otp_request apply (atomic, advisory lock per phone).
export const requestPhoneOtp = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ phone: z.string().min(6).max(40) }).parse(input),
  )
  .handler(async ({ data }) => {
    const phone = normalizePhoneE164(data.phone);
    if (!phone) throw new Error("מספר טלפון לא תקין");

    const otp = generateOtp(); // CSPRNG, uniform 6 digits
    const ip = clientIp();
    const { data: rows, error } = await supabaseAdmin.rpc("phone_otp_request", {
      p_phone: phone.e164,
      p_otp_hash: await hashOtp(otp), // hash only; plaintext is never stored
      p_ip_hash: ip ? await hashIp(ip) : null,
    });
    if (error) throw new Error(OTP_REQUEST_GENERIC_MESSAGE);
    const res = rows?.[0];
    if (res?.outcome === "locked") throw new Error(OTP_LOCKED_MESSAGE);
    if (res?.outcome !== "ok" || !res.request_id) throw new Error(OTP_REQUEST_GENERIC_MESSAGE);
    const request_id = res.request_id;

    // Twilio path: send the OTP via SMS. The SMS itself is the verification,
    // so on success the request is auto-approved.
    const provider = (process.env.SMS_PROVIDER ?? "manual") as "manual" | "twilio";
    if (
      provider === "twilio" &&
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN
    ) {
      const r = await sendViaTwilio({
        channel: "sms",
        to: phone.e164,
        body: `קוד הכניסה שלך ל-Haile AI: ${otp}`,
      });
      if (r.ok) {
        await supabaseAdmin
          .from("phone_login_requests")
          .update({ status: "approved" })
          .eq("id", request_id);
        return { ok: true, request_id, delivery: "sms" as const };
      }
      // Twilio failed — keep the manual admin flow as fallback. Never throw:
      // an SMS outage must not block a student from logging in manually.
      return { ok: true, request_id, delivery: "manual" as const };
    }

    // Manual mode: nobody knows this code. When staff approves the request a
    // fresh code is generated and shown to staff once (approvePhoneRequest).
    return { ok: true, request_id, delivery: "manual" as const };
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
    const phone = normalizePhoneE164(data.phone);
    if (!phone) throw new Error(OTP_GENERIC_MESSAGE);

    // Atomic in SQL: per-phone lockout, 10-min TTL, 5 attempts per code.
    // A correct, approved code is CLAIMED ('verified'); it is consumed only
    // after the account setup below succeeds (released on failure).
    const { data: rows, error } = await supabaseAdmin.rpc("phone_otp_verify", {
      p_phone: phone.e164,
      p_otp_hash: await hashOtp(data.otp),
    });
    if (error) throw new Error(OTP_GENERIC_MESSAGE);
    const result = rows?.[0];
    const msg = otpOutcomeMessage(result?.outcome ?? "invalid");
    if (msg || !result?.request_id) throw new Error(msg ?? OTP_GENERIC_MESSAGE);
    const requestId = result.request_id;

    try {
      const tempPassword = generateTempPassword();
      // Exact lookup (E.164 e-mail first, then legacy formats); no listUsers.
      const { data: existingId, error: lookErr } = await supabaseAdmin.rpc("phone_auth_user_lookup", {
        p_emails: phoneEmailCandidates(data.phone, phone),
      });
      if (lookErr) throw new Error(lookErr.message);

      let userId: string;
      let email: string;
      if (existingId) {
        userId = existingId;
        const { data: got, error: getErr } = await supabaseAdmin.auth.admin.getUserById(userId);
        if (getErr || !got.user?.email) throw new Error(getErr?.message ?? "user not found");
        email = got.user.email;
        const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          password: tempPassword,
          email_confirm: true,
        });
        if (updErr) throw new Error(updErr.message);
      } else {
        email = phoneToEmail(phone.digits);
        const fullName = `סטודנט ${phone.digits.slice(-4)}`;
        const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { phone: phone.e164, full_name: fullName },
        });
        if (createErr || !created.user) throw new Error(createErr?.message ?? "create failed");
        userId = created.user.id;

        // New OTP accounts are leads; staff promote them (payment / link).
        const { error: pErr } = await supabaseAdmin.from("profiles").upsert({
          id: userId, email, phone: phone.e164, full_name: fullName, is_active: true,
        });
        if (pErr) throw new Error(pErr.message);
        await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
        const { error: rErr } = await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "lead" });
        if (rErr) throw new Error(rErr.message);
      }

      const { data: consumed, error: cErr } = await supabaseAdmin.rpc("phone_otp_consume", {
        p_request_id: requestId,
        p_user_id: userId,
      });
      if (cErr || consumed !== true) throw new Error("consume failed");
      return { ok: true, email, password: tempPassword };
    } catch (e) {
      // Setup failed: give the code back (still single use, TTL unchanged).
      await supabaseAdmin.rpc("phone_otp_release", { p_request_id: requestId });
      console.error("[phone-login] account setup failed", e instanceof Error ? e.message : e);
      throw new Error(OTP_GENERIC_MESSAGE);
    }
  });

// Owner/staff approves a pending phone login request. A fresh code is issued
// here (the DB resets its 10-min TTL and attempt counter) and returned to the
// approving staff member ONCE so they can relay it; only its hash is stored.
export const approvePhoneRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertOwnerOrStaff(context.supabase, context.userId);
    const otp = generateOtp();
    const { data: updated, error } = await supabaseAdmin
      .from("phone_login_requests")
      .update({
        status: "approved",
        otp_hash: await hashOtp(otp),
        approved_by: context.userId, // audit
        approved_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .select("id, expires_at");
    if (error) throw new Error(error.message);
    if (!updated || updated.length === 0) {
      throw new Error("הבקשה פגה או כבר טופלה — הסטודנט צריך לבקש קוד חדש");
    }
    return { ok: true, otp, expires_at: updated[0].expires_at as string };
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
      .select("id, phone, status, created_at, expires_at, attempts")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return { rows: data ?? [] };
  });
