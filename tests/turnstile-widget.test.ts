// Run: bun test tests/turnstile-widget.test.ts  (pure helpers; no DOM, no network)
import { describe, expect, test } from "bun:test";
import { applyTurnstileReset, sendOtpDisabled, turnstileRenderOptions } from "../src/components/TurnstileWidget";

describe("TurnstileWidget helpers (HB-01)", () => {
  test("callback sets token; expired/error callbacks null it", () => {
    const seen: (string | null)[] = [];
    const o = turnstileRenderOptions("site", (t) => seen.push(t));
    expect(o.action).toBe("phone_otp");
    o.callback("tok"); o["expired-callback"](); o.callback("tok2"); o["error-callback"]();
    expect(seen).toEqual(["tok", null, "tok2", null]);
  });
  test("resetKey triggers reset and nulls token", () => {
    const resets: (string | undefined)[] = []; const seen: (string | null)[] = [];
    const api = { render: () => "w1", reset: (id?: string) => resets.push(id), remove: () => {} };
    expect(applyTurnstileReset(0, "w1", api, (t) => seen.push(t))).toBe(false);
    expect(applyTurnstileReset(1, "w1", api, (t) => seen.push(t))).toBe(true);
    expect(resets).toEqual(["w1"]); expect(seen).toEqual([null]);
    expect(applyTurnstileReset(2, null, api, () => {})).toBe(false);
  });
  test("send button disabled while no token or busy", () => {
    expect(sendOtpDisabled(false, null)).toBe(true);
    expect(sendOtpDisabled(false, "")).toBe(true);
    expect(sendOtpDisabled(true, "tok")).toBe(true);
    expect(sendOtpDisabled(false, "tok")).toBe(false);
  });
});
