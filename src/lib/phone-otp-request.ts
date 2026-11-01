// HB-01: core of requestPhoneOtp with injected deps so it is unit-testable
// without a request context, Supabase, Twilio or network.
import {
  PHONE_LOGIN_DISABLED_MESSAGE,
  PHONE_LOGIN_NO_IP_MESSAGE,
  phoneLoginEnabled,
  smsIpKey,
} from "./phone-login-gate";
import { verifyTurnstile } from "./turnstile";
import { normalizePhoneE164 } from "./phone";
import {
  OTP_LOCKED_MESSAGE,
  OTP_REQUEST_GENERIC_MESSAGE,
  generateOtp,
  hashIp,
  hashOtp,
} from "./otp";

type Env = Record<string, string | undefined>;

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export type RequestOtpDeps = {
  env: Env;
  ip: string | null;
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: any; error: any }>;
  sendSms: (to: string, body: string) => Promise<{ ok: boolean }>;
  fetchImpl?: typeof fetch;
};

export async function requestPhoneOtpCore(
  data: { phone: string; turnstileToken?: string },
  d: RequestOtpDeps,
) {
  if (!phoneLoginEnabled(d.env)) throw new HttpError(403, PHONE_LOGIN_DISABLED_MESSAGE);
  // R4-3 before Turnstile: refuse IP-less production requests without spending a token.
  const ipKey = smsIpKey(d.ip, d.env);
  if (ipKey.refuse) throw new HttpError(400, PHONE_LOGIN_NO_IP_MESSAGE);
  const ts = await verifyTurnstile({
    token: data.turnstileToken,
    remoteip: d.ip,
    env: d.env,
    fetchImpl: d.fetchImpl,
  });
  if (!ts.ok) {
    console.warn("[phone-login] turnstile rejected", ts.reason);
    throw new HttpError(403, PHONE_LOGIN_DISABLED_MESSAGE);
  }
  const phone = normalizePhoneE164(data.phone);
  if (!phone) throw new Error("מספר טלפון לא תקין");

  const otp = generateOtp();
  const provider = (d.env.SMS_PROVIDER ?? "manual") as "manual" | "twilio";
  const twilio = provider === "twilio" && !!d.env.TWILIO_ACCOUNT_SID && !!d.env.TWILIO_AUTH_TOKEN;
  // Global SMS slot is reserved in the DB (p_reserve_sms) BEFORE Twilio.
  const { data: rows, error } = await d.rpc("phone_otp_request", {
    p_phone: phone.e164,
    p_otp_hash: await hashOtp(phone.e164, otp),
    p_ip_hash: await hashIp(ipKey.key),
    p_reserve_sms: twilio,
  });
  if (error) throw new Error(OTP_REQUEST_GENERIC_MESSAGE);
  const res = rows?.[0];
  if (res?.outcome === "locked") throw new Error(OTP_LOCKED_MESSAGE);
  if (res?.outcome !== "ok" || !res.request_id) throw new Error(OTP_REQUEST_GENERIC_MESSAGE);
  const request_id = res.request_id;

  if (twilio) {
    let sent = false;
    try {
      sent = (await d.sendSms(phone.e164, `קוד הכניסה שלך ל-Haile AI: ${otp}`)).ok;
    } finally {
      await d.rpc("phone_otp_sms_result", { p_request_id: request_id, p_sent: sent });
    }
    if (sent) return { ok: true, request_id, delivery: "sms" as const };
    return { ok: true, request_id, delivery: "manual" as const };
  }
  return { ok: true, request_id, delivery: "manual" as const };
}
