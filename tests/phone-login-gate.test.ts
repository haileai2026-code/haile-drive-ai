// Run: bun test tests/phone-login-gate.test.ts
import { describe, expect, test } from "bun:test";
import { UNKNOWN_IP_BUCKET, phoneLoginEnabled, smsIpKey } from "../src/lib/phone-login-gate";

describe("phoneLoginEnabled (R4-2, fail closed)", () => {
  test("off when unset", () => expect(phoneLoginEnabled({})).toBe(false));
  test("off when switch on but no Turnstile secret", () => {
    expect(phoneLoginEnabled({ PHONE_LOGIN_ENABLED: "on" })).toBe(false);
    expect(phoneLoginEnabled({ PHONE_LOGIN_ENABLED: "on", TURNSTILE_SECRET_KEY: "  " })).toBe(false);
  });
  test("off for anything but 'on'", () => {
    for (const v of ["", "off", "1", "true", "yes", "enabled"])
      expect(phoneLoginEnabled({ PHONE_LOGIN_ENABLED: v, TURNSTILE_SECRET_KEY: "x" })).toBe(false);
  });
  test("independent of VITE_BETA_SENSITIVE_FEATURES", () => {
    expect(phoneLoginEnabled({ VITE_BETA_SENSITIVE_FEATURES: "on", TURNSTILE_SECRET_KEY: "x" })).toBe(false);
  });
  test("on only with switch + secret", () => {
    expect(phoneLoginEnabled({ PHONE_LOGIN_ENABLED: "on", TURNSTILE_SECRET_KEY: "x" })).toBe(true);
    expect(phoneLoginEnabled({ PHONE_LOGIN_ENABLED: " ON ", TURNSTILE_SECRET_KEY: "x" })).toBe(true);
  });
});

describe("smsIpKey (R4-3, null IP never disables limiting)", () => {
  test("ip present -> keyed by ip", () => expect(smsIpKey("203.0.113.9", { VERCEL: "1" })).toEqual({ refuse: false, key: "203.0.113.9" }));
  test("null ip on Vercel -> refuse", () => expect(smsIpKey(null, { VERCEL: "1" })).toEqual({ refuse: true }));
  test("null ip NODE_ENV=production -> refuse", () => expect(smsIpKey(null, { NODE_ENV: "production" })).toEqual({ refuse: true }));
  test("null ip in dev -> one shared bucket", () => {
    const a = smsIpKey(null, {}); const b = smsIpKey(null, { NODE_ENV: "development" });
    expect(a).toEqual({ refuse: false, key: UNKNOWN_IP_BUCKET });
    expect(b).toEqual(a);
  });
});
