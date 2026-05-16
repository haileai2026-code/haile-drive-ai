import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DAILY_API = "https://api.daily.co/v1";

export const createDailyRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      eventId: z.string().uuid(),
      classId: z.string().uuid().nullable().optional(),
      title: z.string().min(1).max(120),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const apiKey = process.env.DAILY_API_KEY;
    if (!apiKey) throw new Error("DAILY_API_KEY is not configured");

    // Only owner/staff/teacher can create rooms
    const { supabase, userId } = context;
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const allowed = (roles ?? []).some((r: any) => ["owner", "staff", "teacher"].includes(r.role));
    if (!allowed) throw new Error("Forbidden");

    const name = `hd-${data.eventId.slice(0, 8)}-${Date.now().toString(36)}`.toLowerCase();
    const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 3;

    const res = await fetch(`${DAILY_API}/rooms`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        properties: {
          max_participants: 30,
          enable_chat: true,
          enable_screenshare: true,
          exp,
        },
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Daily API error ${res.status}: ${txt}`);
    }
    const room = await res.json();
    const url: string = room.url;

    const { error: updErr } = await supabase
      .from("schedule_events")
      .update({ room_url: url, is_live: true })
      .eq("id", data.eventId);
    if (updErr) throw new Error(updErr.message);

    return { url };
  });

export const getClassroomAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ eventId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Block leads
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const roleList = (roles ?? []).map((r: any) => r.role);
    if (roleList.includes("lead") && roleList.length === 1) {
      throw new Error("ליד אינו יכול להצטרף לשיעור חי");
    }

    const { data: event, error } = await supabase
      .from("schedule_events")
      .select("id,title,class_id,room_url,is_live,event_date,start_time,end_time")
      .eq("id", data.eventId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!event) throw new Error("השיעור לא נמצא");
    if (!event.is_live || !event.room_url) throw new Error("השיעור אינו שיעור חי");

    const isTeacherOrAdmin = roleList.some((r: string) => ["owner", "staff", "teacher"].includes(r));

    // Create a meeting token with appropriate role
    const apiKey = process.env.DAILY_API_KEY;
    if (!apiKey) throw new Error("DAILY_API_KEY is not configured");
    const roomName = event.room_url.split("/").pop();
    const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 3;

    const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle();

    const tokRes = await fetch(`${DAILY_API}/meeting-tokens`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        properties: {
          room_name: roomName,
          user_name: profile?.full_name ?? "תלמיד",
          is_owner: isTeacherOrAdmin,
          exp,
        },
      }),
    });
    if (!tokRes.ok) {
      const txt = await tokRes.text();
      throw new Error(`Daily token error ${tokRes.status}: ${txt}`);
    }
    const { token } = await tokRes.json();

    return {
      url: `${event.room_url}?t=${token}`,
      title: event.title,
      classId: event.class_id,
    };
  });
