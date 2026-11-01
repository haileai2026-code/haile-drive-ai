// Server-side gates for phone OTP login (security round 4: R4-2, R4-3).
// Pure functions so they can be unit-tested without a request context.

type Env = Record<string, string | undefined>;

export const PHONE_LOGIN_DISABLED_MESSAGE = "כניסה עם טלפון אינה זמינה כרגע";
export const PHONE_LOGIN_NO_IP_MESSAGE = "הבקשה נדחתה";

/**
 * R5-1 (CTO decision): phone login is HARD-DISABLED in code. It always returns
 * false (-> 403) regardless of env, including PHONE_LOGIN_ENABLED and
 * TURNSTILE_SECRET_KEY. No client CAPTCHA token is read or verified today, so
 * an env switch must not be able to open the SMS path. Re-enabling requires a
 * separate PR that adds server-side Turnstile siteverify (token + remoteip,
 * hostname/action checks, fail closed) and a client widget.
 */
export function phoneLoginEnabled(_env: Env): false {
  return false;
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
