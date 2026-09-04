// SMS provider configuration.
//
// Provider selection: set the SERVER-SIDE env var SMS_PROVIDER to
// "manual" (default) or "twilio".
//
// SECURITY: Twilio credentials must ONLY exist as server-side env vars:
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_SMS_FROM, TWILIO_WHATSAPP_FROM
// Never use VITE_-prefixed names for them — anything VITE_ is bundled into
// the browser JavaScript and would expose the auth token to every visitor.
// The actual send logic lives in src/lib/notifications.functions.ts (server-side).

export type SmsProviderName = "manual" | "twilio";

// Imported by client code too — only touch process.env when it exists.
export const SMS_PROVIDER: SmsProviderName =
  (typeof process !== "undefined"
    ? (process.env.SMS_PROVIDER as SmsProviderName | undefined)
    : undefined) ?? "manual";

// Domain used to synthesize a Supabase auth email from a phone number.
// Format: <digits>@haileai.app
export const PHONE_EMAIL_DOMAIN = "haileai.app";

export function phoneToEmail(phoneDigits: string): string {
  return `${phoneDigits}@${PHONE_EMAIL_DOMAIN}`;
}

export function normalizePhone(input: string): string {
  // keep digits only; strip +, spaces, dashes
  return input.replace(/\D/g, "");
}
