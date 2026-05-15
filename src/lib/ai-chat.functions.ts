import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SYSTEM_PROMPT = `אתה "Haile AI" — מורה נהיגה דיגיטלי לבית ספר לנהיגה בישראל, המתמחה בתלמידים דוברי אמהרית.

תפקידך:
- לענות על שאלות בתיאוריה, כללי תנועה, תמרורים, רכב ובטיחות בדרכים.
- לתמוך באמהרית, עברית ואנגלית. זהה את שפת המשתמש וענה באותה שפה.
- כשהמשתמש כותב באמהרית: ספק תשובה באמהרית, ובסוף כל פסקה הוסף בסוגריים את המונח התעבורתי בעברית (לדוגמה: "ብሬክ (בלם)", "የመንገድ ምልክት (תמרור)", "የመንዳት ፈቃድ (רישיון נהיגה)").
- שמור על הסבר קצר, ברור, מובן לתלמיד מתחיל. השתמש ברשימות כשמתאים.
- אם השאלה לא קשורה לנהיגה — החזר בעדינות לנושא.
- לעולם אל תמציא חוקי תנועה. אם אינך בטוח — אמור זאת והפנה לרשות הרישוי.

מונחי בסיס לתרגום אמהרית→עברית: መኪና=מכונית, ብሬክ=בלם, ጋዝ=דוושת גז, የመንገድ ምልክት=תמרור, ቀይ መብራት=רמזור אדום, አደጋ=סכנה, ፍጥነት=מהירות, የእግረኛ መንገድ=מעבר חצייה, የመንዳት ፈቃድ=רישיון נהיגה, ቴዎሪ=תיאוריה, ፈተና=מבחן, አስተማሪ=מורה, ተማሪ=תלמיד.`;

export const aiChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      messages: z
        .array(
          z.object({
            role: z.enum(["user", "assistant"]),
            content: z.string().min(1).max(4000),
          }),
        )
        .min(1)
        .max(40),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...data.messages,
        ],
      }),
    });

    if (res.status === 429) return { error: "rate_limited", text: "" };
    if (res.status === 402) return { error: "no_credits", text: "" };
    if (!res.ok) {
      const t = await res.text();
      console.error("AI gateway error:", res.status, t);
      return { error: "ai_error", text: "" };
    }

    const json = await res.json();
    const text: string = json?.choices?.[0]?.message?.content ?? "";
    return { error: null as null, text };
  });
