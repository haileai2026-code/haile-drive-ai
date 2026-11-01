// Consent evidence, built on the SERVER only (stored in consents.evidence).
//   web      = { ip_hash, user_agent }  (IP never stored in clear)
//   whatsapp = { message_id, template }
export const EVIDENCE_PEPPER_MIN_LENGTH = 32;
const UA_MAX = 512;

export type WebEvidence = { ip_hash: string | null; user_agent: string };
export type WhatsappEvidence = { message_id: string; template: string };

/** First address of X-Forwarded-For, else X-Real-IP; null when unknown. */
export function clientIpFrom(headers: Headers): string | null {
  const xff = headers.get("x-forwarded-for");
  const first = xff?.split(",")[0]?.trim();
  if (first) return first;
  const real = headers.get("x-real-ip")?.trim();
  return real || null;
}

async function hmacHex(key: string, value: string): Promise<string> {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, enc.encode(value));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * ip_hash = HMAC-SHA256(pepper, ip). Without a valid pepper
 * (CONSENT_EVIDENCE_PEPPER, >= 32 chars) or without an IP the hash is null:
 * the consent is still recorded, the IP is never stored unhashed.
 */
export async function buildWebEvidence(
  ip: string | null,
  userAgent: string | null,
  pepper: string | undefined,
): Promise<WebEvidence> {
  const ok = !!pepper && pepper.length >= EVIDENCE_PEPPER_MIN_LENGTH;
  return {
    ip_hash: ok && ip ? await hmacHex(pepper!, ip) : null,
    user_agent: (userAgent ?? "").slice(0, UA_MAX),
  };
}

export function buildWhatsappEvidence(messageId: string, template: string): WhatsappEvidence {
  if (!messageId.trim() || !template.trim()) throw new Error("whatsapp evidence requires message_id and template");
  return { message_id: messageId.trim().slice(0, 256), template: template.trim().slice(0, 128) };
}
