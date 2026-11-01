// Run: bun test tests/phone-login-gate.test.ts
import { describe, expect, test } from "bun:test";
import { UNKNOWN_IP_BUCKET, phoneLoginEnabled, smsIpKey } from "../src/lib/phone-login-gate";

describe("phoneLoginEnabled (HB-01)", () => {
  const H = { TURNSTILE_ALLOWED_HOSTNAMES: "app.example" };
  test("off unless PHONE_LOGIN_ENABLED=on AND secret AND hostname allowlist", () => {
    for (const e of [{}, { PHONE_LOGIN_ENABLED: "on", ...H }, { TURNSTILE_SECRET_KEY: "x", ...H }, { PHONE_LOGIN_ENABLED: "off", TURNSTILE_SECRET_KEY: "x", ...H }, { PHONE_LOGIN_ENABLED: "on", TURNSTILE_SECRET_KEY: "  ", ...H },
      { PHONE_LOGIN_ENABLED: "on", TURNSTILE_SECRET_KEY: "x" }, { PHONE_LOGIN_ENABLED: "on", TURNSTILE_SECRET_KEY: "x", TURNSTILE_ALLOWED_HOSTNAMES: "" }, { PHONE_LOGIN_ENABLED: "on", TURNSTILE_SECRET_KEY: "x", TURNSTILE_ALLOWED_HOSTNAMES: " , ,  " }])
      expect(phoneLoginEnabled(e)).toBe(false);
  });
  test("on when all set", () => {
    expect(phoneLoginEnabled({ PHONE_LOGIN_ENABLED: "on", TURNSTILE_SECRET_KEY: "x", ...H })).toBe(true);
    expect(phoneLoginEnabled({ PHONE_LOGIN_ENABLED: " ON ", TURNSTILE_SECRET_KEY: "x", TURNSTILE_ALLOWED_HOSTNAMES: " , app.example " })).toBe(true);
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
