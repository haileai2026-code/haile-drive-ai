// Run: bun test tests/phone-otp-request.test.ts  (mocked fetch/rpc/sms; no network, no DB)
import { describe, expect, test } from "bun:test";
import { HttpError, requestPhoneOtpCore } from "../src/lib/phone-otp-request";

const env = { PHONE_LOGIN_ENABLED: "on", TURNSTILE_SECRET_KEY: "test-secret", TURNSTILE_ALLOWED_HOSTNAMES: "app.example", SMS_PROVIDER: "twilio", TWILIO_ACCOUNT_SID: "AC_test", TWILIO_AUTH_TOKEN: "test" };
process.env.OTP_PEPPER ??= "test-pepper-not-a-secret-000000000000"; // dummy, >= 32 chars

function harness(siteverify: unknown, e: Record<string, string | undefined> = env, ip: string | null = "203.0.113.9") {
  const fetches: string[] = []; const rpcs: string[] = []; const sms: string[] = [];
  const deps = {
    env: e, ip,
    fetchImpl: (async (u: string) => { fetches.push(u); return new Response(JSON.stringify(siteverify)); }) as unknown as typeof fetch,
    rpc: async (fn: string) => { rpcs.push(fn); return { data: [{ outcome: "ok", request_id: "r1" }], error: null }; },
    sendSms: async (to: string) => { sms.push(to); return { ok: true }; },
  };
  return { deps, fetches, rpcs, sms };
}
async function status(p: Promise<unknown>) { try { await p; return 200; } catch (e) { return e instanceof HttpError ? e.status : -1; } }
const ok = () => ({ success: true, hostname: "app.example", action: "phone_otp", challenge_ts: new Date().toISOString() });

describe("requestPhoneOtpCore (HB-01 handler)", () => {
  test("rejected token -> 403, no OTP RPC, no Twilio", async () => {
    const h = harness({ success: false, "error-codes": ["invalid-input-response"] });
    expect(await status(requestPhoneOtpCore({ phone: "0501234567", turnstileToken: "bad" }, h.deps))).toBe(403);
    expect(h.fetches.length).toBe(1); expect(h.rpcs).toEqual([]); expect(h.sms).toEqual([]);
  });
  test("gate off -> 403 before siteverify", async () => {
    for (const e of [{ ...env, PHONE_LOGIN_ENABLED: "off" }, { ...env, TURNSTILE_ALLOWED_HOSTNAMES: " " }]) {
      const h = harness(ok(), e);
      expect(await status(requestPhoneOtpCore({ phone: "0501234567", turnstileToken: "t" }, h.deps))).toBe(403);
      expect(h.fetches).toEqual([]); expect(h.rpcs).toEqual([]);
    }
  });
  test("production without IP -> 400 before siteverify (token not spent)", async () => {
    const h = harness(ok(), { ...env, VERCEL: "1" }, null);
    expect(await status(requestPhoneOtpCore({ phone: "0501234567", turnstileToken: "t" }, h.deps))).toBe(400);
    expect(h.fetches).toEqual([]); expect(h.rpcs).toEqual([]);
  });
  test("missing / oversized token -> 403, no siteverify", async () => {
    for (const turnstileToken of [undefined, "x".repeat(2049)]) {
      const h = harness(ok());
      expect(await status(requestPhoneOtpCore({ phone: "0501234567", turnstileToken }, h.deps))).toBe(403);
      expect(h.fetches).toEqual([]); expect(h.rpcs).toEqual([]);
    }
  });
  test("valid token -> RPC + SMS", async () => {
    const h = harness(ok());
    const r = await requestPhoneOtpCore({ phone: "0501234567", turnstileToken: "t" }, h.deps);
    expect(r).toEqual({ ok: true, request_id: "r1", delivery: "sms" });
    expect(h.rpcs).toEqual(["phone_otp_request", "phone_otp_sms_result"]); expect(h.sms.length).toBe(1);
  });
});
