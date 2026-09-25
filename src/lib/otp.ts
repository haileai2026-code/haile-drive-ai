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

export async function hashOtp(otp: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(otp));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export type OtpVerifyOutcome =
  | "locked"
  | "invalid"
  | "failed"
  | "expired"
  | "pending"
  | "rejected"
  | "ok";

// Hebrew user-facing message for each non-ok verify outcome.
export function otpOutcomeMessage(outcome: string | null | undefined): string | null {
  switch (outcome) {
    case "ok":
      return null;
    case "locked":
      return "יותר מדי ניסיונות שגויים. נסה שוב בעוד 15 דקות";
    case "failed":
      return "הקוד נחסם אחרי 5 ניסיונות שגויים. יש לבקש קוד חדש";
    case "expired":
      return "הקוד פג תוקף. יש לבקש קוד חדש";
    case "pending":
      return "ממתין לאישור מנהל";
    case "rejected":
      return "הבקשה נדחתה";
    default:
      return "קוד שגוי";
  }
}
