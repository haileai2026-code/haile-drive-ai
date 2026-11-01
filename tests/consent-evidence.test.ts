// Run: bun test tests/consent-evidence.test.ts
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { EVIDENCE_PEPPER_ERROR, buildWebEvidence, buildWhatsappEvidence, clientIpFrom } from "../src/lib/consent/evidence";
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
  test("missing / short pepper fails closed (no evidence, no row)", async () => {
    await expect(buildWebEvidence("203.0.113.7", "UA", undefined)).rejects.toThrow(EVIDENCE_PEPPER_ERROR);
    await expect(buildWebEvidence("203.0.113.7", "UA", "")).rejects.toThrow(EVIDENCE_PEPPER_ERROR);
    await expect(buildWebEvidence("203.0.113.7", "UA", "x".repeat(31))).rejects.toThrow(EVIDENCE_PEPPER_ERROR);
    await expect(buildWebEvidence(null, "UA", "x".repeat(32))).resolves.toEqual({ ip_hash: null, user_agent: "UA" });
  });
  test("server functions build evidence before any record_consent call", () => {
    const src = readFileSync(new URL("../src/lib/consent/consent.functions.ts", import.meta.url), "utf8");
    for (const name of ["recordMyConsent", "withdrawMyConsent"]) {
      const body = src.slice(src.indexOf(`export const ${name}`));
      const handler = body.slice(body.indexOf(".handler("));
      const ev = handler.indexOf("webEvidence()");
      const ins = handler.indexOf("insert(");
      expect(ev).toBeGreaterThan(-1);
      expect(ins).toBeGreaterThan(ev);
    }
    expect(src.match(/record_consent/g)?.length).toBe(1);
  });
  test("user agent truncated", async () => {
    expect((await buildWebEvidence(null, "x".repeat(2000), PEPPER)).user_agent.length).toBe(512);
  });
  test("client ip from headers", () => {
    // never the client-controlled leftmost X-Forwarded-For
    expect(clientIpFrom(new Headers({ "x-forwarded-for": "6.6.6.6, 198.51.100.1" }), false)).toBeNull();
    expect(clientIpFrom(new Headers({ "x-forwarded-for": "6.6.6.6, 198.51.100.1" }), true)).toBe("198.51.100.1");
    expect(clientIpFrom(new Headers({ "cf-connecting-ip": "198.51.100.3", "x-real-ip": "198.51.100.2" }), true)).toBe("198.51.100.3");
    expect(clientIpFrom(new Headers({ "x-real-ip": "198.51.100.2" }), false)).toBeNull();
    expect(clientIpFrom(new Headers({ "x-real-ip": "198.51.100.2" }), true)).toBe("198.51.100.2");
    expect(clientIpFrom(new Headers(), true)).toBeNull();
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
