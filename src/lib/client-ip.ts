// Client IP for rate limits / evidence hashes. Identical file on
// fix/sec-otp-hardening and feat/consent-record (clean merge).
//
// The IP header is chosen by PLATFORM; a header that the current platform
// does not set (and overwrite) is client-controlled and is never read:
//   - Vercel      (VERCEL=1, set by the platform): ONLY x-vercel-forwarded-for.
//                 cf-connecting-ip is ignored (a client can send it).
//   - Cloudflare  (EDGE_PLATFORM=cloudflare, set explicitly by ops; only when
//                 the origin accepts traffic from Cloudflare exclusively):
//                 ONLY cf-connecting-ip.
//   - TRUSTED_PROXY=on (another reverse proxy that overwrites x-real-ip /
//                 appends to X-Forwarded-For): x-real-ip, else the RIGHTMOST
//                 X-Forwarded-For entry (the hop appended by our proxy).
//   - otherwise null (the per-IP limit then does not apply; global/phone
//     limits still do). The leftmost X-Forwarded-For entry is never used.

const IPV4 = /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;
const IPV6 = /^[0-9a-f:]+$/i;

function valid(ip: string | null | undefined): string | null {
  const v = (ip ?? "").trim();
  if (!v || v.length > 45) return null;
  return IPV4.test(v) || (v.includes(":") && IPV6.test(v)) ? v : null;
}

export type IpPlatform = "vercel" | "cloudflare" | "trusted-proxy" | "none";

export function ipPlatform(env: Record<string, string | undefined> = process.env): IpPlatform {
  if (env.VERCEL === "1") return "vercel";
  if (env.EDGE_PLATFORM === "cloudflare") return "cloudflare";
  if (env.TRUSTED_PROXY === "on") return "trusted-proxy";
  return "none";
}

export function clientIpFrom(
  headers: Headers,
  platform: IpPlatform = ipPlatform(),
): string | null {
  switch (platform) {
    case "vercel":
      return valid(headers.get("x-vercel-forwarded-for")?.split(",")[0]);
    case "cloudflare":
      return valid(headers.get("cf-connecting-ip"));
    case "trusted-proxy": {
      const real = valid(headers.get("x-real-ip"));
      if (real) return real;
      const xff = headers.get("x-forwarded-for")?.split(",") ?? [];
      return valid(xff[xff.length - 1]);
    }
    default:
      return null;
  }
}
