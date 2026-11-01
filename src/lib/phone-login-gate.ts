// Server-side gates for phone OTP login (security round 4: R4-2, R4-3).
// Pure functions so they can be unit-tested without a request context.

type Env = Record<string, string | undefined>;

export const PHONE_LOGIN_DISABLED_MESSAGE = "כניסה עם טלפון אינה זמינה כרגע";
export const PHONE_LOGIN_NO_IP_MESSAGE = "הבקשה נדחתה";

/**
 * HB-01: the phone-login gate opens only when ops set PHONE_LOGIN_ENABLED=on
 * AND TURNSTILE_SECRET_KEY is present AND TURNSTILE_ALLOWED_HOSTNAMES has at
 * least one non-empty entry. This is necessary but not sufficient:
 * requestPhoneOtp additionally verifies a Turnstile token server-side
 * (verifyTurnstile, fail closed) on EVERY request.
 */
export function phoneLoginEnabled(env: Env): boolean {
  return (
    (env.PHONE_LOGIN_ENABLED ?? "").trim().toLowerCase() === "on" &&
    (env.TURNSTILE_SECRET_KEY ?? "").trim().length > 0 &&
    (env.TURNSTILE_ALLOWED_HOSTNAMES ?? "").split(",").some((h) => h.trim().length > 0)
  );
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
export function smsIpKey(
  ip: string | null,
  env: Env,
): { refuse: true } | { refuse: false; key: string } {
  if (ip) return { refuse: false, key: ip };
  if (isProductionEnv(env)) return { refuse: true };
  return { refuse: false, key: UNKNOWN_IP_BUCKET };
}
