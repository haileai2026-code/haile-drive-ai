import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Resolve a material's storage path / URL into a usable URL.
 * - If it already starts with http(s) → returned as-is.
 * - Otherwise → creates a signed URL against the private `materials` bucket.
 */
export async function resolveMaterialUrl(fileUrl: string | null | undefined): Promise<string | null> {
  if (!fileUrl) return null;
  if (/^https?:\/\//i.test(fileUrl)) return fileUrl.replace(/^http:\/\//i, "https://");
  const { data, error } = await supabase.storage
    .from("materials")
    .createSignedUrl(fileUrl, 3600);
  if (error || !data?.signedUrl) {
    if (error) console.error("[materials] signed url failed", error);
    return null;
  }
  return data.signedUrl.replace(/^http:\/\//i, "https://");
}

/** Open a material in a new tab, resolving its URL first. */
export async function openMaterial(opts: { file_url?: string | null; external_link?: string | null }) {
  const target = opts.external_link || (await resolveMaterialUrl(opts.file_url));
  if (!target) {
    toast.error("שגיאה בפתיחת הקובץ");
    return;
  }
  window.open(target, "_blank", "noopener,noreferrer");
}
