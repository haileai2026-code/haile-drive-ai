import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const createUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      email: z.string().email(),
      password: z.string().min(8).max(72),
      full_name: z.string().min(1).max(120),
      phone: z.string().max(40).optional().nullable(),
      role: z.enum(["teacher", "student", "staff"]).default("teacher"),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    // Verify caller is owner
    const { data: roleRow } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "owner")
      .maybeSingle();
    if (!roleRow) throw new Error("Only owners can create users");

    // Create auth user (auto-confirm)
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name, phone: data.phone ?? "" },
    });
    if (error) throw new Error(error.message);
    const newId = created.user!.id;

    const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
      id: newId,
      email: data.email,
      full_name: data.full_name,
      phone: data.phone ?? "",
      is_active: true,
    });
    if (profileError) throw new Error(profileError.message);

    await supabaseAdmin.from("user_roles").delete().eq("user_id", newId);
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newId, role: data.role });
    if (roleError) throw new Error(roleError.message);

    return { id: newId };
  });
