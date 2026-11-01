// Run: bun test tests/turnstile.test.ts  (mocked fetch only; no network)
import { describe, expect, test } from "bun:test";
import { TURNSTILE_SITEVERIFY_URL, verifyTurnstile } from "../src/lib/turnstile";

const env = { TURNSTILE_SECRET_KEY: "test-secret", TURNSTILE_ALLOWED_HOSTNAMES: "app.example, www.app.example" };

function mockFetch(json: unknown, status = 200) {
  const calls: { url: string; init: RequestInit }[] = [];
  const f = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(json), { status });
  }) as unknown as typeof fetch;
  return { f, calls };
}
const good = { success: true, hostname: "app.example", action: "phone_otp" };

describe("verifyTurnstile (HB-01)", () => {
  test("success: posts secret, token, remoteip", async () => {
    const { f, calls } = mockFetch(good);
    expect(await verifyTurnstile({ token: "tok", remoteip: "203.0.113.9", env, fetchImpl: f })).toEqual({ ok: true });
    expect(calls.length).toBe(1);
    expect(calls[0].url).toBe(TURNSTILE_SITEVERIFY_URL);
    expect(calls[0].init.method).toBe("POST");
    const b = calls[0].init.body as URLSearchParams;
    expect(b.get("secret")).toBe("test-secret");
    expect(b.get("response")).toBe("tok");
    expect(b.get("remoteip")).toBe("203.0.113.9");
  });
  test("failure: success=false", async () => {
    const { f } = mockFetch({ success: false, "error-codes": ["invalid-input-response"] });
    expect(await verifyTurnstile({ token: "tok", remoteip: null, env, fetchImpl: f })).toEqual({ ok: false, reason: "not-success" });
  });
  test("http error fails closed", async () => {
    const { f } = mockFetch(good, 500);
    expect((await verifyTurnstile({ token: "tok", remoteip: null, env, fetchImpl: f })).ok).toBe(false);
  });
  test("network error fails closed", async () => {
    const f = (async () => { throw new Error("down"); }) as unknown as typeof fetch;
    expect(await verifyTurnstile({ token: "tok", remoteip: null, env, fetchImpl: f })).toEqual({ ok: false, reason: "network" });
  });
  test("wrong hostname", async () => {
    const { f } = mockFetch({ ...good, hostname: "evil.example" });
    expect(await verifyTurnstile({ token: "tok", remoteip: null, env, fetchImpl: f })).toEqual({ ok: false, reason: "hostname" });
  });
  test("wrong action", async () => {
    const { f } = mockFetch({ ...good, action: "login" });
    expect(await verifyTurnstile({ token: "tok", remoteip: null, env, fetchImpl: f })).toEqual({ ok: false, reason: "action" });
  });
  test("timeout aborts and fails closed", async () => {
    const f = ((_u: string, init: RequestInit) =>
      new Promise((_r, rej) => init.signal!.addEventListener("abort", () => rej(new Error("aborted"))))) as unknown as typeof fetch;
    expect(await verifyTurnstile({ token: "tok", remoteip: null, env, fetchImpl: f, timeoutMs: 20 })).toEqual({ ok: false, reason: "timeout" });
  });
  test("missing token: no fetch", async () => {
    const { f, calls } = mockFetch(good);
    for (const token of [undefined, null, "", "   "])
      expect(await verifyTurnstile({ token, remoteip: null, env, fetchImpl: f })).toEqual({ ok: false, reason: "missing-token" });
    expect(calls.length).toBe(0);
  });
  test("missing secret: no fetch", async () => {
    const { f, calls } = mockFetch(good);
    expect(await verifyTurnstile({ token: "tok", remoteip: null, env: { TURNSTILE_ALLOWED_HOSTNAMES: "app.example" }, fetchImpl: f })).toEqual({ ok: false, reason: "missing-secret" });
    expect(calls.length).toBe(0);
  });
  test("missing hostname allowlist: no fetch", async () => {
    const { f, calls } = mockFetch(good);
    expect(await verifyTurnstile({ token: "tok", remoteip: null, env: { TURNSTILE_SECRET_KEY: "s" }, fetchImpl: f })).toEqual({ ok: false, reason: "missing-allowlist" });
    expect(calls.length).toBe(0);
  });
});
