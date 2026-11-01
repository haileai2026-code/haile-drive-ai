// Login-code generation. Uses the Web Crypto CSPRNG (available in Node 20+,
// Workers and browsers) with rejection sampling so every 6-digit code
// 000000-999999 is equally likely. Never use Math.random() for secrets.

const OTP_SPACE = 1_000_000;
// Largest multiple of OTP_SPACE that fits in 2^32; values >= this are rejected
// to avoid modulo bias.
const LIMIT = Math.floor(0x1_0000_0000 / OTP_SPACE) * OTP_SPACE;

export function generateOtp(
  rand: (buf: Uint32Array) => Uint32Array = (b) => crypto.getRandomValues(b),
): string {
  const buf = new Uint32Array(1);
  for (;;) {
    const v = rand(buf)[0];
    if (v < LIMIT) return String(v % OTP_SPACE).padStart(6, "0");
  }
}

// Limits below are enforced in SQL (phone_otp_verify / phone_login_requests_guard);
// the constants document them for the app and the unit tests.
export const OTP_TTL_MINUTES = 10; // code lifetime from issue
export const OTP_MAX_ATTEMPTS_PER_CODE = 5; // 5th wrong guess invalidates the code
export const OTP_MAX_FAILED_ATTEMPTS = 5; // per phone per 15 min (lockout)
export const OTP_MAX_REQUESTS_PER_WINDOW = 3; // per phone per 15 min
// Request limits enforced in public.phone_otp_request (same constants there).
export const OTP_LIMITS = {
  perPhonePer15Min: OTP_MAX_REQUESTS_PER_WINDOW,
  failedPerPhonePer15Min: OTP_MAX_FAILED_ATTEMPTS,
  perIpPerHour: 10,
  globalSmsPerHour: 200,
  globalRowsPerHour: 1000,
} as const;

// OTP codes are stored as HMAC-SHA256(OTP_PEPPER, phone + ":" + code), hex
// (bound to the E.164 phone, so a hash is useless for any other number). OTP_PEPPER is a
// SERVER-ONLY secret (never VITE_-prefixed; generate with `openssl rand -hex 32`).
// Without it the 10^6 code space could be brute-forced from a leaked hash, so
// the server fails closed when it is missing or too short.
export const OTP_PEPPER_MIN_LENGTH = 32;

export function getOtpPepper(): string {
  const p = typeof process !== "undefined" ? process.env.OTP_PEPPER : undefined;
  if (!p || p.length < OTP_PEPPER_MIN_LENGTH) {
    throw new Error("OTP_PEPPER is not configured (server secret, >= 32 chars)");
  }
  return p;
}

async function hmacHex(key: CryptoKey, msg: string): Promise<string> {
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hmacKey(raw: BufferSource): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}

/** HMAC-SHA256(OTP_PEPPER, phoneE164 + ":" + code). */
export async function hashOtp(phoneE164: string, code: string, pepper: string = getOtpPepper()): Promise<string> {
  return hmacHex(await hmacKey(new TextEncoder().encode(pepper)), `${phoneE164}:${code}`);
}

/** Separate key for IP hashes: HKDF-SHA256(OTP_PEPPER, info=label). No new env var. */
export const OTP_IP_HKDF_INFO = "haile/otp/ip-hash/v1";
export async function deriveIpKey(pepper: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const base = await crypto.subtle.importKey("raw", enc.encode(pepper), "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(32), info: enc.encode(OTP_IP_HKDF_INFO) },
    base,
    256,
  );
  return hmacKey(bits);
}

export type OtpVerifyOutcome =
  | "locked"
  | "invalid"
  | "failed"
  | "expired"
  | "pending"
  | "rejected"
  | "ok";

// User-facing messages. Deliberately ONE generic message for every outcome
// except ok / locked, so responses do not reveal whether a phone exists, a
// request is pending, a code expired, etc.
export const OTP_GENERIC_MESSAGE = "הקוד שגוי או שאינו בתוקף. נסו שוב או בקשו קוד חדש";
export const OTP_LOCKED_MESSAGE = "יותר מדי ניסיונות שגויים. נסו שוב בעוד 15 דקות";
export const OTP_REQUEST_GENERIC_MESSAGE = "לא ניתן לשלוח קוד כרגע. נסו שוב מאוחר יותר";

export function otpOutcomeMessage(outcome: string | null | undefined): string | null {
  if (outcome === "ok") return null;
  if (outcome === "locked") return OTP_LOCKED_MESSAGE;
  return OTP_GENERIC_MESSAGE;
}

/** HMAC of the client IP for the per-IP limit (never stored in clear). */
export async function hashIp(ip: string, pepper: string = getOtpPepper()): Promise<string> {
  return hmacHex(await deriveIpKey(pepper), ip);
}
