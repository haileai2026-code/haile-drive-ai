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
        | "missing-secret"
        | "missing-allowlist"
        | "network"
        | "timeout"
        | "http"
        | "bad-response"
        | "not-success"
        | "hostname"
        | "action";
    };

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
}): Promise<TurnstileResult> {
  const env = opts.env ?? process.env;
  const token = (opts.token ?? "").trim();
  // Cloudflare tokens are at most 2048 chars.
  if (!token || token.length > 2048) return { ok: false, reason: "missing-token" };
  const secret = (env.TURNSTILE_SECRET_KEY ?? "").trim();
  if (!secret) return { ok: false, reason: "missing-secret" };
  const hosts = allowedHostnames(env);
  if (hosts.length === 0) return { ok: false, reason: "missing-allowlist" };

  const body = new URLSearchParams({ secret, response: token });
  if (opts.remoteip) body.set("remoteip", opts.remoteip);

  const ctrl = new AbortController();
  const ms = opts.timeoutMs ?? TURNSTILE_TIMEOUT_MS;
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, ms);
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
  if (!json || typeof json !== "object") return { ok: false, reason: "bad-response" };
  if (json.success !== true) return { ok: false, reason: "not-success" };
  const host = typeof json.hostname === "string" ? json.hostname.toLowerCase() : "";
  if (!host || !hosts.includes(host)) return { ok: false, reason: "hostname" };
  if (json.action !== TURNSTILE_ACTION) return { ok: false, reason: "action" };
  return { ok: true };
}
