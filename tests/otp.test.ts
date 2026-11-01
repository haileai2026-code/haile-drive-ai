// Run: bun test tests/otp.test.ts   (no extra dependencies)
import { describe, expect, test } from "bun:test";
import {
  OTP_MAX_ATTEMPTS_PER_CODE,
  OTP_MAX_FAILED_ATTEMPTS,
  OTP_MAX_REQUESTS_PER_WINDOW,
  OTP_TTL_MINUTES,
  generateOtp,
  getOtpPepper,
  hashOtp,
  otpOutcomeMessage,
} from "../src/lib/otp";

describe("generateOtp", () => {
  test("always 6 ASCII digits", () => {
    for (let i = 0; i < 20_000; i++) expect(generateOtp()).toMatch(/^\d{6}$/);
  });

  test("roughly uniform: each leading digit ~10%, each last digit ~10%", () => {
    const N = 200_000;
    const first = new Array(10).fill(0);
    const last = new Array(10).fill(0);
    for (let i = 0; i < N; i++) {
      const c = generateOtp();
      first[+c[0]]++;
      last[+c[5]]++;
    }
    // chi-square, 9 dof; p=0.001 critical value ~27.88
    const chi = (xs: number[]) => xs.reduce((a, o) => a + (o - N / 10) ** 2 / (N / 10), 0);
    expect(chi(first)).toBeLessThan(27.88);
    expect(chi(last)).toBeLessThan(27.88);
  });

  test("rejection sampling drops biased values and can return 000000", () => {
    const seq = [0xffffffff, 0]; // first value is >= LIMIT and must be rejected
    let i = 0;
    const fake = (b: Uint32Array) => {
      b[0] = seq[i++];
      return b;
    };
    expect(generateOtp(fake)).toBe("000000");
    expect(i).toBe(2);
  });

  test("does not use Math.random", () => {
    const orig = Math.random;
    Math.random = () => {
      throw new Error("Math.random used");
    };
    try {
      expect(generateOtp()).toMatch(/^\d{6}$/);
    } finally {
      Math.random = orig;
    }
  });
});

describe("hashOtp (HMAC-SHA256 with OTP_PEPPER)", () => {
  const PEPPER = "test-pepper-0123456789abcdef0123456789abcdef"; // synthetic, test only
  const PH = "+972501234567";
  test("HMAC-SHA256(PEPPER, phone + ':' + code)", async () => {
    expect(await hashOtp(PH, "123456", PEPPER)).toBe(
      "a93d897a99085cdda04b1a7105f24cf6912b859b704a1daca973195a56c3e67c",
    );
    expect(await hashOtp("+972501234568", "123456", PEPPER)).not.toBe(await hashOtp(PH, "123456", PEPPER));
    expect(await hashOtp(PH, "000000", PEPPER)).toMatch(/^[0-9a-f]{64}$/);
    expect(await hashOtp(PH, "000000", PEPPER)).not.toBe(await hashOtp(PH, "000001", PEPPER));
  });
  test("different pepper -> different hash; never the plain sha256", async () => {
    expect(await hashOtp(PH, "123456", PEPPER)).not.toBe(await hashOtp(PH, "123456", PEPPER + "x"));
    expect(await hashOtp(PH, "123456", PEPPER)).not.toBe(
      "8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92",
    );
  });
  test("fails closed without a (long enough) OTP_PEPPER", async () => {
    const orig = process.env.OTP_PEPPER;
    try {
      delete process.env.OTP_PEPPER;
      expect(() => getOtpPepper()).toThrow();
      process.env.OTP_PEPPER = "short";
      expect(() => getOtpPepper()).toThrow();
      process.env.OTP_PEPPER = PEPPER;
      expect(getOtpPepper()).toBe(PEPPER);
    } finally {
      if (orig === undefined) delete process.env.OTP_PEPPER;
      else process.env.OTP_PEPPER = orig;
    }
  });
});

describe("OTP policy constants and verify outcomes", () => {
  test("CTO-approved limits", () => {
    expect(OTP_TTL_MINUTES).toBe(10);
    expect(OTP_MAX_ATTEMPTS_PER_CODE).toBe(5);
    expect(OTP_MAX_FAILED_ATTEMPTS).toBe(5);
    expect(OTP_MAX_REQUESTS_PER_WINDOW).toBe(3);
  });

  test("only 'ok' lets the login proceed", () => {
    expect(otpOutcomeMessage("ok")).toBeNull();
    for (const o of ["locked", "invalid", "failed", "expired", "pending", "rejected", undefined, "weird"]) {
      expect(otpOutcomeMessage(o)).toBeTruthy();
    }
  });

  test("failed/expired codes tell the student to request a new code", () => {
    expect(otpOutcomeMessage("failed")).toContain("קוד חדש");
    expect(otpOutcomeMessage("expired")).toContain("קוד חדש");
  });
});
