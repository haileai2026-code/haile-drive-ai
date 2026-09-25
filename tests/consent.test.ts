// Run: bun test tests/consent.test.ts
import { describe, expect, test } from "bun:test";
import {
  CHECKBOX_VERSION,
  NOTICE_VERSION,
  PARTNER_CHECKBOX_VERSION,
  TERMS_VERSION,
  needsRequiredConsent,
  partnerSharingGranted,
} from "../src/lib/consent/versions";

const current = {
  consent_type: "privacy_terms_abroad",
  granted: true,
  notice_version: NOTICE_VERSION,
  terms_version: TERMS_VERSION,
  checkbox_version: `${CHECKBOX_VERSION}-he`,
};

describe("needsRequiredConsent", () => {
  test("first login (no record) -> prompt", () => {
    expect(needsRequiredConsent(null)).toBe(true);
  });
  test("current versions granted -> no prompt", () => {
    expect(needsRequiredConsent(current)).toBe(false);
  });
  test("any version change -> re-prompt", () => {
    expect(needsRequiredConsent({ ...current, notice_version: "campus-privacy-v0.3" })).toBe(true);
    expect(needsRequiredConsent({ ...current, terms_version: "campus-terms-beta-v0.3" })).toBe(true);
    expect(needsRequiredConsent({ ...current, checkbox_version: "campus-consent-v0.2-he" })).toBe(true);
  });
  test("withdrawn -> prompt", () => {
    expect(needsRequiredConsent({ ...current, granted: false })).toBe(true);
  });
  test("language of the shown text does not force a re-prompt", () => {
    expect(needsRequiredConsent({ ...current, checkbox_version: `${CHECKBOX_VERSION}-am` })).toBe(false);
  });
});

describe("partnerSharingGranted", () => {
  const p = { ...current, consent_type: "partner_individual_progress", terms_version: null, checkbox_version: `${PARTNER_CHECKBOX_VERSION}-he` };
  test("latest granted for current text -> granted", () => expect(partnerSharingGranted(p)).toBe(true));
  test("withdrawn or old text -> not granted", () => {
    expect(partnerSharingGranted({ ...p, granted: false })).toBe(false);
    expect(partnerSharingGranted({ ...p, checkbox_version: "campus-consent-partner-v0.2-he" })).toBe(false);
    expect(partnerSharingGranted(null)).toBe(false);
  });
});
