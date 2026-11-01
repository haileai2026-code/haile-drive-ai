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
 * Synthetic e-mails to look up, in preference order: the E.164 form first,
 * then legacy formats written by older builds (digits of the raw input, and
 * the national form with a leading 0, e.g. 0501234567@...).
 */
export function phoneEmailCandidates(input: string, n: NormalizedPhone): string[] {
  const out = [phoneToEmail(n.digits)];
  const raw = (input ?? "").replace(/\D/g, "");
  if (raw) out.push(phoneToEmail(raw));
  const p = parsePhoneNumberFromString(n.e164);
  if (p?.country === "IL") out.push(phoneToEmail(`0${p.nationalNumber}`));
  return [...new Set(out)];
}
