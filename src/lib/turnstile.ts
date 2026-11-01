// HB-01: server-side Cloudflare Turnstile siteverify. Fails closed on ANY
// error (missing token/secret/allowlist, network error, timeout, non-2xx,
// bad JSON, success=false, wrong hostname, wrong action).

type Env = Record<string, string | undefined>;

export const TURNSTILE_SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
export const TURNSTILE_ACTION = "phone_otp";
export const TURNSTILE_TIMEOUT_MS = 5000;

export type TurnstileResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "missing-token"
        | "token-too-long"
        | "missing-secret"
        | "missing-allowlist"
        | "network"
        | "timeout"
        | "http"
        | "bad-response"
        | "not-success"
        | "hostname"
        | "action"
        | "stale";
    };

/** Max age of challenge_ts (seconds). TURNSTILE_MAX_AGE_SECONDS overrides; 0 disables. */
export const TURNSTILE_MAX_AGE_DEFAULT = 300;
function maxAgeSeconds(env: Env): number {
  const raw = (env.TURNSTILE_MAX_AGE_SECONDS ?? "").trim();
  if (!raw) return TURNSTILE_MAX_AGE_DEFAULT;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : TURNSTILE_MAX_AGE_DEFAULT;
}

export function allowedHostnames(env: Env): string[] {
  return (env.TURNSTILE_ALLOWED_HOSTNAMES ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

export async function verifyTurnstile(opts: {
  token: string | null | undefined;
  remoteip: string | null;
  env?: Env;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  now?: () => number;
}): Promise<TurnstileResult> {
  const env = opts.env ?? process.env;
  const token = (opts.token ?? "").trim();
  // Cloudflare tokens are at most 2048 chars.
  if (!token) return { ok: false, reason: "missing-token" };
  if (token.length > 2048) return { ok: false, reason: "token-too-long" };
  const secret = (env.TURNSTILE_SECRET_KEY ?? "").trim();
  if (!secret) return { ok: false, reason: "missing-secret" };
  const hosts = allowedHostnames(env);
  if (hosts.length === 0) return { ok: false, reason: "missing-allowlist" };

  const body = new URLSearchParams({ secret, response: token });
  if (opts.remoteip) body.set("remoteip", opts.remoteip);

  const ctrl = new AbortController();
  const ms = opts.timeoutMs ?? TURNSTILE_TIMEOUT_MS;
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctrl.abort();
  }, ms);
  let res: Response;
  try {
    res = await (opts.fetchImpl ?? fetch)(TURNSTILE_SITEVERIFY_URL, {
      method: "POST",
      body,
      signal: ctrl.signal,
    });
  } catch {
    clearTimeout(timer);
    return { ok: false, reason: timedOut ? "timeout" : "network" };
  }
  let json: any;
  try {
    if (!res.ok) return { ok: false, reason: "http" };
    json = await res.json();
  } catch {
    return { ok: false, reason: timedOut ? "timeout" : "bad-response" };
  } finally {
    clearTimeout(timer);
  }
  if (!json || typeof json !== "object" || Array.isArray(json))
    return { ok: false, reason: "bad-response" };
  if (json.success !== true) {
    // Server-side log only; error-codes never reach the client response.
    const codes = Array.isArray(json["error-codes"])
      ? json["error-codes"].filter((c: unknown) => typeof c === "string").slice(0, 10)
      : [];
    console.warn("[turnstile] siteverify not-success", codes.join(","));
    return { ok: false, reason: "not-success" };
  }
  const host = typeof json.hostname === "string" ? json.hostname.toLowerCase() : "";
  if (!host || !hosts.includes(host)) return { ok: false, reason: "hostname" };
  if (json.action !== TURNSTILE_ACTION) return { ok: false, reason: "action" };
  const maxAge = maxAgeSeconds(env);
  if (maxAge > 0) {
    const ts = typeof json.challenge_ts === "string" ? Date.parse(json.challenge_ts) : NaN;
    const now = (opts.now ?? Date.now)();
    if (!Number.isFinite(ts) || now - ts > maxAge * 1000) return { ok: false, reason: "stale" };
  }
  return { ok: true };
}
