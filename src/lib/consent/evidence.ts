// Consent evidence, built on the SERVER only (stored in consents.evidence).
//   web      = { ip_hash, user_agent }  (IP never stored in clear)
//   whatsapp = { message_id, template }
export const EVIDENCE_PEPPER_MIN_LENGTH = 32;
const UA_MAX = 512;

export type WebEvidence = { ip_hash: string | null; user_agent: string };
export type WhatsappEvidence = { message_id: string; template: string };

// Client IP: same trusted-header logic as phone OTP (never the leftmost
// X-Forwarded-For); see src/lib/client-ip.ts.
export { clientIpFrom } from "../client-ip";

async function hmacHex(key: string, value: string): Promise<string> {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, enc.encode(value));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

export const EVIDENCE_PEPPER_ERROR =
  "Consent not recorded: server misconfigured (CONSENT_EVIDENCE_PEPPER missing or shorter than 32 characters)";

/** Fail closed: throws unless the pepper is set and >= 32 chars. */
export function requireEvidencePepper(pepper: string | undefined): string {
  if (!pepper || pepper.length < EVIDENCE_PEPPER_MIN_LENGTH) throw new Error(EVIDENCE_PEPPER_ERROR);
  return pepper;
}

/**
 * ip_hash = HMAC-SHA256(pepper, ip). FAILS CLOSED: without a valid pepper
 * (CONSENT_EVIDENCE_PEPPER, >= 32 chars) it throws, so no consent row is ever
 * written without evidence. Only an unknown client IP gives ip_hash = null;
 * the IP is never stored unhashed.
 */
export async function buildWebEvidence(
  ip: string | null,
  userAgent: string | null,
  pepper: string | undefined,
): Promise<WebEvidence> {
  const key = requireEvidencePepper(pepper);
  return {
    ip_hash: ip ? await hmacHex(key, ip) : null,
    user_agent: (userAgent ?? "").slice(0, UA_MAX),
  };
}

export function buildWhatsappEvidence(messageId: string, template: string): WhatsappEvidence {
  if (!messageId.trim() || !template.trim()) throw new Error("whatsapp evidence requires message_id and template");
  return { message_id: messageId.trim().slice(0, 256), template: template.trim().slice(0, 128) };
}
