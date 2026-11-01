// Phone normalisation: parsed ONCE with libphonenumber-js (default region IL)
// and used for the DB key, the synthetic auth e-mail and the SMS target.
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { phoneToEmail } from "./sms/config";

export type NormalizedPhone = {
  /** E.164 with "+", e.g. +972501234567: DB key and SMS target */
  e164: string;
  /** E.164 digits without "+": synthetic e-mail local part */
  digits: string;
};

export function normalizePhoneE164(input: string): NormalizedPhone | null {
  const p = parsePhoneNumberFromString((input ?? "").trim(), "IL");
  if (!p || !p.isValid()) return null;
  return { e164: p.number, digits: p.number.slice(1) };
}

/**
 * Synthetic e-mails to look up, in preference order. Derived ONLY from the
 * parsed number (never from raw user input): the E.164 digits first, then the
 * legacy national form with a leading 0 (e.g. 0501234567@...) written by
 * older builds.
 */
export function phoneEmailCandidates(n: NormalizedPhone): string[] {
  const out = [phoneToEmail(n.digits)];
  const p = parsePhoneNumberFromString(n.e164);
  if (p?.nationalNumber) out.push(phoneToEmail(`0${p.nationalNumber}`));
  return [...new Set(out)];
}
