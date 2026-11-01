// Server-side gates for phone OTP login (security round 4: R4-2, R4-3).
// Pure functions so they can be unit-tested without a request context.

type Env = Record<string, string | undefined>;

export const PHONE_LOGIN_DISABLED_MESSAGE = "כניסה עם טלפון אינה זמינה כרגע";
export const PHONE_LOGIN_NO_IP_MESSAGE = "הבקשה נדחתה";

/**
 * R4-2: phone login is OFF unless the server switch PHONE_LOGIN_ENABLED=on is
 * set AND a Turnstile secret (TURNSTILE_SECRET_KEY) is present. Fails closed
 * when unset or misconfigured. Independent of VITE_BETA_SENSITIVE_FEATURES
 * (a client flag must never enable a server path).
 */
export function phoneLoginEnabled(env: Env): boolean {
  const sw = (env.PHONE_LOGIN_ENABLED ?? "").trim().toLowerCase();
  if (sw !== "on") return false;
  return (env.TURNSTILE_SECRET_KEY ?? "").trim().length > 0;
}

export function isProductionEnv(env: Env): boolean {
  return env.VERCEL === "1" || env.NODE_ENV === "production";
}

/** Shared bucket used for the per-IP limit when no client IP is known outside production. */
export const UNKNOWN_IP_BUCKET = "unknown-ip-shared-bucket";

/**
 * R4-3: a missing client IP must never disable the per-IP limit.
 * - production (VERCEL=1 or NODE_ENV=production): refuse (caller returns 400);
 * - otherwise (local dev / tests): all IP-less requests share ONE strict bucket.
 */
export function smsIpKey(ip: string | null, env: Env): { refuse: true } | { refuse: false; key: string } {
  if (ip) return { refuse: false, key: ip };
  if (isProductionEnv(env)) return { refuse: true };
  return { refuse: false, key: UNKNOWN_IP_BUCKET };
}
