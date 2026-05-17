// SMS provider configuration.
// Switch SMS_PROVIDER to enable a real SMS gateway.
// Options: 'manual' | 'twilio'
//
// Manual mode (current): OTP requests are stored in `phone_login_requests` and
// surfaced to the owner via a community announcement + the admin panel
// (/admin/phone-requests). The owner approves the request and the student
// can then complete sign-in with the same OTP.
//
// Twilio mode (future): set TWILIO_CONFIG values via Lovable Secrets:
//   VITE_TWILIO_ACCOUNT_SID
//   VITE_TWILIO_AUTH_TOKEN
//   VITE_TWILIO_PHONE_NUMBER
// Then send the OTP via SMS from a server function instead of the manual flow.

export type SmsProviderName = "manual" | "twilio";

export const SMS_PROVIDER: SmsProviderName = "manual";

export const TWILIO_CONFIG = {
  accountSid: import.meta.env.VITE_TWILIO_ACCOUNT_SID ?? "",
  authToken: import.meta.env.VITE_TWILIO_AUTH_TOKEN ?? "",
  fromNumber: import.meta.env.VITE_TWILIO_PHONE_NUMBER ?? "",
};

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
