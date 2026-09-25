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

export const OTP_MAX_FAILED_ATTEMPTS = 5; // per phone per 15 min (enforced in SQL)
