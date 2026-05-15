import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function isAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId)
    .in("role", ["owner", "staff"]);
  return (data?.length ?? 0) > 0;
}

const PostType = z.enum(["post", "question", "announcement"]);
const FeedbackType = z.enum(["bug", "feature", "complaint", "compliment"]);
const FeedbackStatus = z.enum(["open", "in_review", "resolved"]);
const Recipient = z.enum(["owner", "teacher", "secretary"]);

// ---------- Community feed ----------

export const listFeedPosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("community_posts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);

    const authorIds = Array.from(new Set((data ?? []).map((p: any) => p.author_id)));
    const profiles = authorIds.length
      ? (await supabase.from("profiles").select("id,full_name,email").in("id", authorIds)).data ?? []
      : [];
    const map = new Map(profiles.map((p: any) => [p.id, p]));
    return (data ?? []).map((p: any) => ({
      ...p,
      author: map.get(p.author_id) ?? null,
    }));
  });

export const createPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        content: z.string().trim().min(1).max(2000),
        post_type: PostType.default("post"),
        media_url: z.string().url().max(800).optional().nullable(),
        class_id: z.string().uuid().optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let classId = data.class_id ?? null;
    if (!classId && data.post_type !== "announcement") {
      const { data: r } = await supabase.rpc("current_user_class_id");
      classId = (r as string) ?? null;
    }
    const { data: row, error } = await supabase
      .from("community_posts")
      .insert({
        author_id: userId,
        class_id: classId,
        content: data.content,
        media_url: data.media_url ?? null,
        post_type: data.post_type,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listComments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ post_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("community_comments")
      .select("*")
      .eq("post_id", data.post_id)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((rows ?? []).map((c: any) => c.author_id)));
    const profiles = ids.length
      ? (await supabase.from("profiles").select("id,full_name,email").in("id", ids)).data ?? []
      : [];
    const m = new Map(profiles.map((p: any) => [p.id, p]));
    return (rows ?? []).map((c: any) => ({ ...c, author: m.get(c.author_id) ?? null }));
  });

export const addComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ post_id: z.string().uuid(), content: z.string().trim().min(1).max(1000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("community_comments")
      .insert({ post_id: data.post_id, author_id: userId, content: data.content })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

// ---------- Feedback ----------

export const submitFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        type: FeedbackType,
        title: z.string().trim().min(1).max(200),
        content: z.string().trim().min(1).max(2000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("feedback_reports")
      .insert({ author_id: userId, ...data })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const myFeedback = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("feedback_reports")
      .select("*")
      .eq("author_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ---------- Contact ----------

export const sendContactMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        recipient_role: Recipient,
        subject: z.string().trim().min(1).max(200),
        content: z.string().trim().min(1).max(2000),
        parent_id: z.string().uuid().optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("contact_messages")
      .insert({
        sender_id: userId,
        recipient_role: data.recipient_role,
        subject: data.subject,
        content: data.content,
        parent_id: data.parent_id ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const myContactThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    // Fetch all messages I sent OR replies to threads I started
    const { data: own, error } = await supabase
      .from("contact_messages")
      .select("*")
      .eq("sender_id", userId);
    if (error) throw new Error(error.message);
    const rootIds = (own ?? []).filter((m: any) => !m.parent_id).map((m: any) => m.id);
    let replies: any[] = [];
    if (rootIds.length) {
      const { data: r } = await supabase
        .from("contact_messages")
        .select("*")
        .in("parent_id", rootIds);
      replies = r ?? [];
    }
    const all = [...(own ?? []), ...replies];
    return all.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
  });

// ---------- Admin inbox ----------

export const adminListInbox = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await isAdmin(context))) throw new Error("Forbidden");
    const { supabase } = context;
    const [fb, cm] = await Promise.all([
      supabase.from("feedback_reports").select("*").order("created_at", { ascending: false }),
      supabase.from("contact_messages").select("*").order("created_at", { ascending: false }),
    ]);
    if (fb.error) throw new Error(fb.error.message);
    if (cm.error) throw new Error(cm.error.message);

    const senderIds = Array.from(
      new Set([
        ...(fb.data ?? []).map((r: any) => r.author_id),
        ...(cm.data ?? []).map((r: any) => r.sender_id),
      ]),
    );
    const profiles = senderIds.length
      ? (await supabase.from("profiles").select("id,full_name,email").in("id", senderIds)).data ?? []
      : [];
    const m = new Map(profiles.map((p: any) => [p.id, p]));

    return {
      feedback: (fb.data ?? []).map((r: any) => ({ ...r, author: m.get(r.author_id) ?? null })),
      contacts: (cm.data ?? []).map((r: any) => ({ ...r, sender: m.get(r.sender_id) ?? null })),
    };
  });

export const updateFeedbackStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        status: FeedbackStatus,
        admin_response: z.string().trim().max(2000).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context))) throw new Error("Forbidden");
    const { supabase, userId } = context;
    const patch: any = { status: data.status };
    if (data.admin_response !== undefined) {
      patch.admin_response = data.admin_response;
      patch.responded_by = userId;
      patch.responded_at = new Date().toISOString();
    }
    const { error } = await supabase.from("feedback_reports").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const replyToContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        parent_id: z.string().uuid(),
        content: z.string().trim().min(1).max(2000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context))) throw new Error("Forbidden");
    const { supabase, userId } = context;
    const { data: parent, error: pe } = await supabase
      .from("contact_messages")
      .select("subject,recipient_role")
      .eq("id", data.parent_id)
      .single();
    if (pe || !parent) throw new Error(pe?.message ?? "Parent not found");
    const { data: row, error } = await supabase
      .from("contact_messages")
      .insert({
        sender_id: userId,
        recipient_role: parent.recipient_role,
        subject: `RE: ${parent.subject}`,
        content: data.content,
        parent_id: data.parent_id,
        is_read: true,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await supabase.from("contact_messages").update({ is_read: true }).eq("id", data.parent_id);
    return row;
  });

export const markContactRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context))) throw new Error("Forbidden");
    const { supabase } = context;
    const { error } = await supabase.from("contact_messages").update({ is_read: true }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
