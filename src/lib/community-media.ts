// community-media is a PRIVATE bucket. Posts store the object path
// ("<uploaderId>/<uuid>.<ext>"); the client resolves a short-lived signed URL
// at render time. Legacy rows that stored a full public URL
// (.../storage/v1/object/public/community-media/<path>) are mapped back to
// their path so they keep working after the bucket went private.

export const COMMUNITY_MEDIA_BUCKET = "community-media";
export const COMMUNITY_MEDIA_SIGNED_URL_TTL = 3600; // seconds (1 h)

const STORAGE_URL_RE =
  /\/storage\/v1\/object\/(?:public|sign|authenticated)\/community-media\/([^?#]+)/;
const PATH_RE = /^[0-9a-fA-F-]{36}\/[A-Za-z0-9._-]{1,200}$/;

/** Object path for a stored media value, or null if it is not community-media. */
export function communityMediaPath(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim();
  if (/^https?:\/\//i.test(v)) {
    const m = v.match(STORAGE_URL_RE);
    if (!m) return null;
    try {
      return decodeURIComponent(m[1]);
    } catch {
      return null;
    }
  }
  return v.replace(/^\/+/, "");
}

/** True if `path` is a well-formed object path inside `userId`'s own folder. */
export function isOwnCommunityMediaPath(path: string, userId: string): boolean {
  return PATH_RE.test(path) && path.split("/")[0] === userId && !path.includes("..");
}
