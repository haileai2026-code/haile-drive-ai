import { describe, expect, test } from "bun:test";
import { clientIpFrom, ipPlatform } from "../src/lib/client-ip";

const h = (o: Record<string, string>) => new Headers(o);

describe("ipPlatform", () => {
  test("detection", () => {
    expect(ipPlatform({ VERCEL: "1" })).toBe("vercel");
    expect(ipPlatform({ VERCEL: "1", EDGE_PLATFORM: "cloudflare" })).toBe("vercel");
    expect(ipPlatform({ EDGE_PLATFORM: "cloudflare" })).toBe("cloudflare");
    expect(ipPlatform({ TRUSTED_PROXY: "on" })).toBe("trusted-proxy");
    expect(ipPlatform({})).toBe("none");
    expect(ipPlatform({ VERCEL: "true" })).toBe("none");
  });
});

describe("clientIpFrom", () => {
  test("Vercel: forged cf-connecting-ip is ignored", () => {
    expect(clientIpFrom(h({ "cf-connecting-ip": "6.6.6.6", "x-vercel-forwarded-for": "1.2.3.4" }), "vercel")).toBe("1.2.3.4");
    expect(clientIpFrom(h({ "cf-connecting-ip": "6.6.6.6" }), "vercel")).toBeNull();
    expect(clientIpFrom(h({ "x-forwarded-for": "6.6.6.6, 1.2.3.4", "x-real-ip": "6.6.6.6" }), "vercel")).toBeNull();
  });
  test("Vercel via env: forged cf-connecting-ip ignored", () => {
    const p = ipPlatform({ VERCEL: "1" });
    expect(clientIpFrom(h({ "cf-connecting-ip": "6.6.6.6" }), p)).toBeNull();
  });
  test("Cloudflare: only cf-connecting-ip", () => {
    expect(clientIpFrom(h({ "cf-connecting-ip": "1.2.3.4", "x-vercel-forwarded-for": "6.6.6.6" }), "cloudflare")).toBe("1.2.3.4");
    expect(clientIpFrom(h({ "x-vercel-forwarded-for": "6.6.6.6", "x-forwarded-for": "6.6.6.6" }), "cloudflare")).toBeNull();
  });
  test("trusted proxy: x-real-ip, else rightmost XFF; platform headers ignored", () => {
    expect(clientIpFrom(h({ "x-real-ip": "1.2.3.4", "cf-connecting-ip": "6.6.6.6" }), "trusted-proxy")).toBe("1.2.3.4");
    expect(clientIpFrom(h({ "x-forwarded-for": "6.6.6.6, 1.2.3.4" }), "trusted-proxy")).toBe("1.2.3.4");
    expect(clientIpFrom(h({ "cf-connecting-ip": "6.6.6.6", "x-vercel-forwarded-for": "6.6.6.6" }), "trusted-proxy")).toBeNull();
  });
  test("no platform: null for every header", () => {
    expect(clientIpFrom(h({ "cf-connecting-ip": "1.2.3.4", "x-vercel-forwarded-for": "1.2.3.4", "x-real-ip": "1.2.3.4", "x-forwarded-for": "1.2.3.4" }), "none")).toBeNull();
  });
  test("invalid values rejected", () => {
    expect(clientIpFrom(h({ "x-vercel-forwarded-for": "evil" }), "vercel")).toBeNull();
    expect(clientIpFrom(h({ "cf-connecting-ip": "::1" }), "cloudflare")).toBe("::1");
  });
});
