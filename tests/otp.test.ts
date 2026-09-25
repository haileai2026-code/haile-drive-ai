// Run: bun test tests/otp.test.ts   (no extra dependencies)
import { describe, expect, test } from "bun:test";
import { generateOtp } from "../src/lib/otp";

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
