// Server-side consent enforcement for student data server functions.
// Students/leads must hold the CURRENT required consent (checkbox 1);
// owner/staff/teacher accounts are exempt. The check runs in the DB
// (public.consent_ok -> consent_version_allowed) so versions have one source.
import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const CONSENT_REQUIRED = "CONSENT_REQUIRED";
const EXEMPT_ROLES = new Set(["owner", "staff", "teacher"]);

/** Use after requireSupabaseAuth: `.middleware([requireSupabaseAuth, requireCurrentConsent])`. */
export const requireCurrentConsent = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    // Body stays inside .server() so the service-role client never reaches the client bundle.
    const { data: roles, error: rErr } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", context.userId);
    if (rErr) throw new Error(CONSENT_REQUIRED);
    if (!(roles ?? []).some((r) => EXEMPT_ROLES.has(r.role))) {
      const { data, error } = await supabaseAdmin.rpc("consent_ok", { p_user_id: context.userId });
      if (error || data !== true) throw new Error(CONSENT_REQUIRED); // fail closed
    }
    return next();
  });
