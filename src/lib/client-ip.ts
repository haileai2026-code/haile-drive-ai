// Client IP for rate limits / evidence hashes. Identical file on
// fix/sec-otp-hardening and feat/consent-record (clean merge).
//
// Never trust the LEFTMOST X-Forwarded-For entry: the client controls it.
// Order:
//   1. cf-connecting-ip        (set by Cloudflare, overwrites client values)
//   2. x-vercel-forwarded-for  (set by the Vercel edge)
//   3. x-real-ip               ONLY behind a known proxy (see below)
//   4. rightmost X-Forwarded-For entry, ONLY behind a known proxy (the hop
//      appended by our own proxy)
//   otherwise null (the per-IP limit then does not apply; global/phone
//   limits still do).
// "Known proxy" = running on Vercel (VERCEL=1, set by the platform) or
// TRUSTED_PROXY=on set explicitly by ops for another reverse proxy that
// overwrites x-real-ip / appends to X-Forwarded-For.

const IPV4 = /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;
const IPV6 = /^[0-9a-f:]+$/i;

function valid(ip: string | null | undefined): string | null {
  const v = (ip ?? "").trim();
  if (!v || v.length > 45) return null;
  return IPV4.test(v) || (v.includes(":") && IPV6.test(v)) ? v : null;
}

export function behindTrustedProxy(env: Record<string, string | undefined> = process.env): boolean {
  return env.VERCEL === "1" || env.TRUSTED_PROXY === "on";
}

export function clientIpFrom(
  headers: Headers,
  trustedProxy: boolean = behindTrustedProxy(),
): string | null {
  const cf = valid(headers.get("cf-connecting-ip"));
  if (cf) return cf;
  const vercel = valid(headers.get("x-vercel-forwarded-for")?.split(",")[0]);
  if (vercel) return vercel;
  if (!trustedProxy) return null;
  const real = valid(headers.get("x-real-ip"));
  if (real) return real;
  const xff = headers.get("x-forwarded-for")?.split(",") ?? [];
  return valid(xff[xff.length - 1]);
}
