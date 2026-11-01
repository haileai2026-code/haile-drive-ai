// Run: bun test tests/phone.test.ts
import { describe, expect, test } from "bun:test";
import { normalizePhoneE164, phoneEmailCandidates } from "../src/lib/phone";
import { behindTrustedProxy, clientIpFrom } from "../src/lib/client-ip";
import {
  OTP_GENERIC_MESSAGE,
  OTP_LIMITS,
  OTP_LOCKED_MESSAGE,
  hashIp,
  hashOtp,
  otpOutcomeMessage,
} from "../src/lib/otp";

const PEPPER = "test-pepper-0123456789abcdef0123456789abcdef";

describe("normalizePhoneE164 (region IL)", () => {
  test.each(["050-123-4567", "0501234567", "+972 50 123 4567", "972501234567", "00972501234567"])("%s", (raw) => {
    expect(normalizePhoneE164(raw)).toEqual({ e164: "+972501234567", digits: "972501234567" });
  });
  test("invalid numbers rejected", () => {
    expect(normalizePhoneE164("12")).toBeNull();
    expect(normalizePhoneE164("abc")).toBeNull();
  });
});

describe("phoneEmailCandidates", () => {
  test("E.164 first, then legacy formats, no duplicates", () => {
    const n = normalizePhoneE164("050-123-4567")!;
    expect(phoneEmailCandidates(n)).toEqual([
      "972501234567@haileai.app",
      "0501234567@haileai.app",
    ]);
    expect(phoneEmailCandidates(normalizePhoneE164("00972-50-123-4567")!)).toEqual([
      "972501234567@haileai.app",
      "0501234567@haileai.app",
    ]);
  });
});

describe("generic OTP messages", () => {
  test("only ok and locked differ", () => {
    expect(otpOutcomeMessage("ok")).toBeNull();
    expect(otpOutcomeMessage("locked")).toBe(OTP_LOCKED_MESSAGE);
    for (const o of ["invalid", "failed", "expired", "pending", "rejected", "limited", undefined]) {
      expect(otpOutcomeMessage(o)).toBe(OTP_GENERIC_MESSAGE);
    }
  });
  test("limits match the SQL constants", () => {
    expect(OTP_LIMITS).toEqual({ perPhonePer15Min: 3, failedPerPhonePer15Min: 5, perIpPerHour: 10, globalSmsPerHour: 200 });
  });
});

describe("hashIp", () => {
  test("HMAC with an HKDF-derived key, separate from the OTP key", async () => {
    const h = await hashIp("203.0.113.7", PEPPER);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(await hashIp("203.0.113.7", PEPPER)).toBe(h);
    const { createHmac } = await import("node:crypto");
    expect(h).not.toBe(createHmac("sha256", PEPPER).update("203.0.113.7").digest("hex"));
    expect(h).not.toBe(createHmac("sha256", PEPPER).update("ip:203.0.113.7").digest("hex"));
    const { hkdfSync } = await import("node:crypto");
    const k = Buffer.from(hkdfSync("sha256", PEPPER, Buffer.alloc(32), "haile/otp/ip-hash/v1", 32));
    expect(h).toBe(createHmac("sha256", k).update("203.0.113.7").digest("hex"));
  });
});

describe("clientIpFrom", () => {
  const H = (o: Record<string, string>) => new Headers(o);
  test("never the leftmost X-Forwarded-For", () => {
    expect(clientIpFrom(H({ "x-forwarded-for": "6.6.6.6, 198.51.100.9" }), false)).toBeNull();
    expect(clientIpFrom(H({ "x-forwarded-for": "6.6.6.6, 198.51.100.9" }), true)).toBe("198.51.100.9");
  });
  test("order: cf-connecting-ip, x-vercel-forwarded-for, x-real-ip (trusted proxy only)", () => {
    const all = { "cf-connecting-ip": "203.0.113.1", "x-vercel-forwarded-for": "203.0.113.2", "x-real-ip": "203.0.113.3" };
    expect(clientIpFrom(H(all), false)).toBe("203.0.113.1");
    expect(clientIpFrom(H({ "x-vercel-forwarded-for": "203.0.113.2", "x-real-ip": "203.0.113.3" }), false)).toBe("203.0.113.2");
    expect(clientIpFrom(H({ "x-real-ip": "203.0.113.3" }), false)).toBeNull();
    expect(clientIpFrom(H({ "x-real-ip": "203.0.113.3" }), true)).toBe("203.0.113.3");
    expect(clientIpFrom(H({ "cf-connecting-ip": "not-an-ip" }), false)).toBeNull();
    expect(behindTrustedProxy({ VERCEL: "1" })).toBe(true);
    expect(behindTrustedProxy({})).toBe(false);
  });
});

describe("SQL limits are the same constants", () => {
  test("phone_otp_request constants", async () => {
    const sql = await Bun.file(new URL("../supabase/migrations/20260925120200_sec_otp_hardening.sql", import.meta.url)).text();
    expect(sql).toContain(`c_phone_per_15min constant integer := ${OTP_LIMITS.perPhonePer15Min};`);
    expect(sql).toContain(`c_fail_per_15min  constant integer := ${OTP_LIMITS.failedPerPhonePer15Min};`);
    expect(sql).toContain(`c_ip_per_hour     constant integer := ${OTP_LIMITS.perIpPerHour};`);
    expect(sql).toContain(`c_global_per_hour constant integer := ${OTP_LIMITS.globalSmsPerHour};`);
  });
});
