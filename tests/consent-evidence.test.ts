// Run: bun test tests/consent-evidence.test.ts
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { buildWebEvidence, buildWhatsappEvidence, clientIpFrom } from "../src/lib/consent/evidence";
import { CHECKBOX_VERSION, NOTICE_VERSION, PARTNER_CHECKBOX_VERSION, TERMS_VERSION } from "../src/lib/consent/versions";

const PEPPER = "test-pepper-0123456789abcdef0123456789abcdef";

describe("consent evidence", () => {
  test("ip is HMAC-hashed, never stored in clear", async () => {
    const ev = await buildWebEvidence("203.0.113.7", "UA/1.0", PEPPER);
    expect(ev.ip_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(ev)).not.toContain("203.0.113.7");
    expect(ev.user_agent).toBe("UA/1.0");
    expect((await buildWebEvidence("203.0.113.7", null, PEPPER)).ip_hash).toBe(ev.ip_hash);
  });
  test("no / short pepper -> ip_hash null (still has both keys)", async () => {
    const ev = await buildWebEvidence("203.0.113.7", "UA", "short");
    expect(ev).toEqual({ ip_hash: null, user_agent: "UA" });
  });
  test("user agent truncated", async () => {
    expect((await buildWebEvidence(null, "x".repeat(2000), PEPPER)).user_agent.length).toBe(512);
  });
  test("client ip from headers", () => {
    expect(clientIpFrom(new Headers({ "x-forwarded-for": "198.51.100.1, 10.0.0.1" }))).toBe("198.51.100.1");
    expect(clientIpFrom(new Headers({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(clientIpFrom(new Headers())).toBeNull();
  });
  test("whatsapp evidence requires message id and template", () => {
    expect(buildWhatsappEvidence(" wamid.1 ", "consent_v1")).toEqual({ message_id: "wamid.1", template: "consent_v1" });
    expect(() => buildWhatsappEvidence("", "t")).toThrow();
  });
});

describe("TS versions match the DB allowed-versions check", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20260925120400_consent_record.sql", import.meta.url), "utf8");
  const fn = sql.slice(sql.indexOf("function public.consent_version_allowed"));
  test.each([NOTICE_VERSION, TERMS_VERSION, CHECKBOX_VERSION, PARTNER_CHECKBOX_VERSION])("%s", (v) => {
    expect(fn).toContain(`'${v}'`);
  });
});
