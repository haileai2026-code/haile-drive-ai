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
const good = () => ({ success: true, hostname: "app.example", action: "phone_otp", challenge_ts: new Date().toISOString() });

describe("verifyTurnstile (HB-01)", () => {
  test("success: posts secret, token, remoteip", async () => {
    const { f, calls } = mockFetch(good());
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
    const { f } = mockFetch(good(), 500);
    expect((await verifyTurnstile({ token: "tok", remoteip: null, env, fetchImpl: f })).ok).toBe(false);
  });
  test("network error fails closed", async () => {
    const f = (async () => { throw new Error("down"); }) as unknown as typeof fetch;
    expect(await verifyTurnstile({ token: "tok", remoteip: null, env, fetchImpl: f })).toEqual({ ok: false, reason: "network" });
  });
  test("wrong hostname", async () => {
    const { f } = mockFetch({ ...good(), hostname: "evil.example" });
    expect(await verifyTurnstile({ token: "tok", remoteip: null, env, fetchImpl: f })).toEqual({ ok: false, reason: "hostname" });
  });
  test("wrong action", async () => {
    const { f } = mockFetch({ ...good(), action: "login" });
    expect(await verifyTurnstile({ token: "tok", remoteip: null, env, fetchImpl: f })).toEqual({ ok: false, reason: "action" });
  });
  test("timeout aborts and fails closed", async () => {
    const f = ((_u: string, init: RequestInit) =>
      new Promise((_r, rej) => init.signal!.addEventListener("abort", () => rej(new Error("aborted"))))) as unknown as typeof fetch;
    expect(await verifyTurnstile({ token: "tok", remoteip: null, env, fetchImpl: f, timeoutMs: 20 })).toEqual({ ok: false, reason: "timeout" });
  });
  test("missing token: no fetch", async () => {
    const { f, calls } = mockFetch(good());
    for (const token of [undefined, null, "", "   "])
      expect(await verifyTurnstile({ token, remoteip: null, env, fetchImpl: f })).toEqual({ ok: false, reason: "missing-token" });
    expect(calls.length).toBe(0);
  });
  test("missing secret: no fetch", async () => {
    const { f, calls } = mockFetch(good());
    expect(await verifyTurnstile({ token: "tok", remoteip: null, env: { TURNSTILE_ALLOWED_HOSTNAMES: "app.example" }, fetchImpl: f })).toEqual({ ok: false, reason: "missing-secret" });
    expect(calls.length).toBe(0);
  });
  test("missing hostname allowlist: no fetch", async () => {
    const { f, calls } = mockFetch(good());
    expect(await verifyTurnstile({ token: "tok", remoteip: null, env: { TURNSTILE_SECRET_KEY: "s" }, fetchImpl: f })).toEqual({ ok: false, reason: "missing-allowlist" });
    expect(calls.length).toBe(0);
  });

  test("2049-char token -> token-too-long, no fetch; 2048 ok", async () => {
    const { f, calls } = mockFetch(good());
    expect(await verifyTurnstile({ token: "a".repeat(2049), remoteip: null, env, fetchImpl: f })).toEqual({ ok: false, reason: "token-too-long" });
    expect(calls.length).toBe(0);
    expect((await verifyTurnstile({ token: "a".repeat(2048), remoteip: null, env, fetchImpl: f })).ok).toBe(true);
  });
  test("res.json() throws -> bad-response", async () => {
    const f = (async () => ({ ok: true, json: async () => { throw new SyntaxError("x"); } })) as unknown as typeof fetch;
    expect(await verifyTurnstile({ token: "tok", remoteip: null, env, fetchImpl: f })).toEqual({ ok: false, reason: "bad-response" });
  });
  test("non-JSON body -> bad-response", async () => {
    const f = (async () => new Response("<html>oops</html>", { status: 200 })) as unknown as typeof fetch;
    expect(await verifyTurnstile({ token: "tok", remoteip: null, env, fetchImpl: f })).toEqual({ ok: false, reason: "bad-response" });
  });
  test("null / string / [] JSON -> bad-response; {} -> not-success", async () => {
    for (const j of [null, "ok", 42, []]) {
      const { f } = mockFetch(j);
      expect(await verifyTurnstile({ token: "tok", remoteip: null, env, fetchImpl: f })).toEqual({ ok: false, reason: "bad-response" });
    }
    const { f } = mockFetch({});
    expect(await verifyTurnstile({ token: "tok", remoteip: null, env, fetchImpl: f })).toEqual({ ok: false, reason: "not-success" });
  });
  test('success:"true" string rejected', async () => {
    const { f } = mockFetch({ ...good(), success: "true" });
    expect(await verifyTurnstile({ token: "tok", remoteip: null, env, fetchImpl: f })).toEqual({ ok: false, reason: "not-success" });
  });
  test("not-success logs error-codes server-side only", async () => {
    const orig = console.warn; const logs: unknown[][] = [];
    console.warn = (...a: unknown[]) => { logs.push(a); };
    try {
      const { f } = mockFetch({ success: false, "error-codes": ["timeout-or-duplicate"] });
      const r = await verifyTurnstile({ token: "tok", remoteip: null, env, fetchImpl: f });
      expect(r).toEqual({ ok: false, reason: "not-success" });
      expect(JSON.stringify(r)).not.toContain("timeout-or-duplicate");
      expect(logs.some((l) => l.join(" ").includes("timeout-or-duplicate"))).toBe(true);
    } finally { console.warn = orig; }
  });
  test("hostname missing -> hostname; uppercase matches case-insensitively", async () => {
    const { hostname: _h, ...noHost } = good();
    let m = mockFetch(noHost);
    expect(await verifyTurnstile({ token: "tok", remoteip: null, env, fetchImpl: m.f })).toEqual({ ok: false, reason: "hostname" });
    m = mockFetch({ ...good(), hostname: "APP.Example" });
    expect(await verifyTurnstile({ token: "tok", remoteip: null, env: { ...env, TURNSTILE_ALLOWED_HOSTNAMES: "WWW.APP.EXAMPLE,App.Example" }, fetchImpl: m.f })).toEqual({ ok: true });
  });
  test("whitespace in hostname list is trimmed", async () => {
    const { f } = mockFetch({ ...good(), hostname: "www.app.example" });
    expect(await verifyTurnstile({ token: "tok", remoteip: null, env: { ...env, TURNSTILE_ALLOWED_HOSTNAMES: "  app.example ,\t www.app.example  , ," }, fetchImpl: f })).toEqual({ ok: true });
    const { f: f2, calls } = mockFetch(good());
    expect(await verifyTurnstile({ token: "tok", remoteip: null, env: { ...env, TURNSTILE_ALLOWED_HOSTNAMES: " , , " }, fetchImpl: f2 })).toEqual({ ok: false, reason: "missing-allowlist" });
    expect(calls.length).toBe(0);
  });
  test("remoteip null -> not sent", async () => {
    const { f, calls } = mockFetch(good());
    expect((await verifyTurnstile({ token: "tok", remoteip: null, env, fetchImpl: f })).ok).toBe(true);
    expect((calls[0].init.body as URLSearchParams).has("remoteip")).toBe(false);
  });
  test("challenge_ts freshness: >300s stale, missing stale, configurable, 0 disables", async () => {
    const now = Date.parse("2026-11-01T12:00:00Z");
    const at = (s: number) => new Date(now - s * 1000).toISOString();
    const run = (j: object, e: Record<string, string> = env) => verifyTurnstile({ token: "tok", remoteip: null, env: e, fetchImpl: mockFetch(j).f, now: () => now });
    expect(await run({ ...good(), challenge_ts: at(299) })).toEqual({ ok: true });
    expect(await run({ ...good(), challenge_ts: at(301) })).toEqual({ ok: false, reason: "stale" });
    const { challenge_ts: _c, ...noTs } = good();
    expect(await run(noTs)).toEqual({ ok: false, reason: "stale" });
    expect(await run({ ...good(), challenge_ts: "garbage" })).toEqual({ ok: false, reason: "stale" });
    expect(await run({ ...good(), challenge_ts: at(100) }, { ...env, TURNSTILE_MAX_AGE_SECONDS: "60" })).toEqual({ ok: false, reason: "stale" });
    expect(await run({ ...good(), challenge_ts: at(9999) }, { ...env, TURNSTILE_MAX_AGE_SECONDS: "0" })).toEqual({ ok: true });
  });
});
