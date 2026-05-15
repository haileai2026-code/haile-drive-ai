import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireOwnerOrStaff(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId)
    .in("role", ["owner", "staff"]);
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("Forbidden");
}

type Channel = "sms" | "whatsapp";

function normalizePhone(raw: string): string | null {
  const t = (raw || "").trim().replace(/[\s\-()]/g, "");
  if (!t) return null;
  if (t.startsWith("+")) return t;
  if (t.startsWith("00")) return "+" + t.slice(2);
  if (t.startsWith("0")) return "+972" + t.slice(1); // default Israel
  return "+" + t;
}

async function sendViaTwilio(opts: {
  channel: Channel;
  to: string;
  body: string;
}): Promise<{ ok: true; sid: string } | { ok: false; error: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const smsFrom = process.env.TWILIO_SMS_FROM;
  const waFrom = process.env.TWILIO_WHATSAPP_FROM;
  if (!sid || !token) return { ok: false, error: "Twilio credentials are not configured" };

  const from =
    opts.channel === "whatsapp"
      ? waFrom?.startsWith("whatsapp:") ? waFrom : `whatsapp:${waFrom ?? ""}`
      : smsFrom;
  if (!from || from === "whatsapp:") {
    return { ok: false, error: `Missing FROM number for ${opts.channel}` };
  }

  const to = opts.channel === "whatsapp" ? `whatsapp:${opts.to}` : opts.to;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const auth = "Basic " + Buffer.from(`${sid}:${token}`).toString("base64");
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: from, Body: opts.body }),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: json?.message || `HTTP ${res.status}` };
  }
  return { ok: true, sid: json.sid };
}

function adminSb() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Process all pending notifications whose scheduled_at <= now(). */
export const processPendingNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
  await requireOwnerOrStaff(context);
  const sb = adminSb();
  const nowIso = new Date().toISOString();
  const { data: rows, error } = await sb
    .from("notifications")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_at", nowIso)
    .limit(50);
  if (error) throw new Error(error.message);

  let sent = 0;
  let failed = 0;
  for (const row of rows ?? []) {
    const r = await sendViaTwilio({
      channel: row.channel as Channel,
      to: row.to_phone,
      body: row.message,
    });
    if (r.ok) {
      await sb
        .from("notifications")
        .update({ status: "sent", sent_at: new Date().toISOString(), provider_sid: r.sid, error: null })
        .eq("id", row.id);
      sent++;
    } else {
      await sb
        .from("notifications")
        .update({ status: "failed", error: r.error })
        .eq("id", row.id);
      failed++;
    }
  }
  return { processed: rows?.length ?? 0, sent, failed };
});

/** Send a single notification immediately (manual). */
export const sendNotificationNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireOwnerOrStaff(context);
    const sb = adminSb();
    const { data: row, error } = await sb
      .from("notifications")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Notification not found");
    if (row.status !== "pending") throw new Error(`Cannot send (status=${row.status})`);

    const r = await sendViaTwilio({
      channel: row.channel as Channel,
      to: row.to_phone,
      body: row.message,
    });
    if (r.ok) {
      await sb
        .from("notifications")
        .update({ status: "sent", sent_at: new Date().toISOString(), provider_sid: r.sid, error: null })
        .eq("id", row.id);
      return { ok: true as const };
    }
    await sb.from("notifications").update({ status: "failed", error: r.error }).eq("id", row.id);
    return { ok: false as const, error: r.error };
  });

export { normalizePhone };
