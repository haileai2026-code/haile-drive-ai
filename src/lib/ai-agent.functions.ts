import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const InputSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(8000),
      }),
    )
    .max(30)
    .default([]),
});

async function buildSnapshot() {
  const since30 = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  const [
    candidatesRes,
    classesRes,
    citiesRes,
    examRes,
    feedbackRes,
    contactRes,
    attendanceRes,
    recentCandidatesRes,
  ] = await Promise.all([
    supabaseAdmin.from("candidates").select("status, city_id, updated_at"),
    supabaseAdmin.from("classes").select("id, name"),
    supabaseAdmin.from("cities").select("id, name, name_he"),
    supabaseAdmin.from("exam_results").select("score, passed"),
    supabaseAdmin.from("feedback_reports").select("status"),
    supabaseAdmin.from("contact_messages").select("is_read"),
    supabaseAdmin.from("attendance_records").select("mark").gte("lesson_date", since30),
    supabaseAdmin
      .from("candidates")
      .select("full_name, status, city_id, updated_at")
      .order("updated_at", { ascending: false })
      .limit(20),
  ]);

  const candidates = candidatesRes.data ?? [];
  const cities = citiesRes.data ?? [];
  const cityName = (id: string | null) =>
    cities.find((c) => c.id === id)?.name_he || cities.find((c) => c.id === id)?.name || "—";

  const byStatus: Record<string, number> = {};
  const byCity: Record<string, number> = {};
  const now = Date.now();
  let stale48h = 0;
  for (const c of candidates) {
    byStatus[c.status] = (byStatus[c.status] ?? 0) + 1;
    const cn = cityName(c.city_id);
    byCity[cn] = (byCity[cn] ?? 0) + 1;
    if (now - new Date(c.updated_at).getTime() > 48 * 3600 * 1000) stale48h++;
  }

  const exams = examRes.data ?? [];
  const examAvg = exams.length ? exams.reduce((s, e) => s + (e.score ?? 0), 0) / exams.length : 0;
  const examPassed = exams.filter((e) => e.passed).length;

  const fb = feedbackRes.data ?? [];
  const fbByStatus: Record<string, number> = {};
  for (const f of fb) fbByStatus[f.status] = (fbByStatus[f.status] ?? 0) + 1;

  const att = attendanceRes.data ?? [];
  const attPresent = att.filter((a) => a.mark === "present").length;
  const attPct = att.length ? Math.round((attPresent / att.length) * 100) : 0;

  return {
    timestamp: new Date().toISOString(),
    candidates: {
      total: candidates.length,
      stale_48h: stale48h,
      by_status: byStatus,
      by_city: byCity,
      recent_20: (recentCandidatesRes.data ?? []).map((c) => ({
        name: c.full_name,
        status: c.status,
        city: cityName(c.city_id),
        updated: c.updated_at,
      })),
    },
    classes: {
      total: (classesRes.data ?? []).length,
      names: (classesRes.data ?? []).map((c) => c.name),
    },
    exam_results: {
      total: exams.length,
      passed: examPassed,
      pass_rate_pct: exams.length ? Math.round((examPassed / exams.length) * 100) : 0,
      avg_score: Math.round(examAvg * 10) / 10,
    },
    feedback_reports: { total: fb.length, by_status: fbByStatus },
    contact_messages: {
      total: (contactRes.data ?? []).length,
      unread: (contactRes.data ?? []).filter((c) => !c.is_read).length,
    },
    attendance_30d: { records: att.length, present_pct: attPct },
  };
}

const SYSTEM = `אתה סוכן AI של Haile Drive AI — מערכת הכשרת נהגים מהקהילה האתיופית.
אתה עוזר לבני אספה, המייסד והמנכ"ל, לנהל את המערכת.
ענה תמיד בעברית. היה ישיר, מקצועי, ממוקד נתונים.
כשיש נתונים — הצג אותם בצורה ברורה (רשימות, מספרים, אחוזים).
המספרים חשובים — תמיד ציין כמה מועמדים, כמה השלימו, כמה נשרו.
אם המשתמש מבקש לבצע פעולת כתיבה (עדכון/מחיקה/יצירה) — הסבר בקצרה איך לעשות זאת בפאנל המתאים, אך אל תבצע בעצמך.
אל תמציא מספרים — השתמש רק בנתוני ה-SNAPSHOT שמסופקים לך.`;

export const aiAgentChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    // owner-only
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (!roles?.some((r) => r.role === "owner")) {
      return { error: "forbidden", text: "" };
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return { error: "no_key", text: "חסר ANTHROPIC_API_KEY בהגדרות." };

    let snapshot: unknown;
    try {
      snapshot = await buildSnapshot();
    } catch (e) {
      console.error("snapshot error", e);
      snapshot = { error: "snapshot_failed" };
    }

    const system = `${SYSTEM}\n\nSNAPSHOT (נתונים חיים מהמערכת, JSON):\n${JSON.stringify(snapshot)}`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 1024,
        system,
        messages: [...data.history, { role: "user", content: data.message }],
      }),
    });

    if (res.status === 401) return { error: "unauthorized", text: "" };
    if (res.status === 429) return { error: "rate_limited", text: "" };
    if (!res.ok) {
      const t = await res.text();
      console.error("Anthropic error", res.status, t);
      return { error: "ai_error", text: "" };
    }

    const json = await res.json();
    const text: string =
      json?.content?.map((c: { type: string; text?: string }) => (c.type === "text" ? c.text ?? "" : "")).join("") ?? "";
    return { error: null as null, text };
  });
