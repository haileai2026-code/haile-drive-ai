// Run: bun test tests/phone-login-gate.test.ts
import { describe, expect, test } from "bun:test";
import { UNKNOWN_IP_BUCKET, phoneLoginEnabled, smsIpKey } from "../src/lib/phone-login-gate";

describe("phoneLoginEnabled (R5-1, hard-disabled in code)", () => {
  test("always off, whatever the env", () => {
    const envs = [
      {},
      { PHONE_LOGIN_ENABLED: "on" },
      { PHONE_LOGIN_ENABLED: "on", TURNSTILE_SECRET_KEY: "x" },
      { PHONE_LOGIN_ENABLED: " ON ", TURNSTILE_SECRET_KEY: "x", TURNSTILE_ALLOWED_HOSTNAMES: "a.example" },
      { VITE_BETA_SENSITIVE_FEATURES: "on", PHONE_LOGIN_ENABLED: "on", TURNSTILE_SECRET_KEY: "x" },
    ];
    for (const e of envs) expect(phoneLoginEnabled(e)).toBe(false);
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
