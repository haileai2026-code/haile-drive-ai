import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SYSTEM_PROMPT = `You are an expert driving theory teacher for Haile Drive AI.
You specialize in teaching bus and heavy vehicle theory to students from Ethiopian, Russian, and Tribe of Manasseh communities in Israel.

CRITICAL LANGUAGE RULES:
- If the student writes in Amharic (አማርኛ): respond ONLY in proper, clear Amharic. Use simple words. Never mix with English or Hebrew.
- If the student writes in Hebrew (עברית): respond ONLY in proper modern Hebrew. Simple sentences. Never mix with English or Amharic.
- If the student writes in Russian (русский): respond ONLY in proper Russian. Never mix languages.
- Detect the language automatically from the student's message and always respond in the same language.

TEACHING STYLE:
- Simple, clear explanations — no complex technical terms
- Use real-world examples from bus driving
- Be encouraging and patient
- If a student makes a mistake — correct gently and explain why
- Keep answers short (3-4 sentences max) unless student asks for more detail

CONTENT FOCUS:
- Israeli traffic laws and signs
- Bus and heavy vehicle operation
- Passenger safety
- Pre-trip inspection
- Handling difficult situations (traffic, passengers, emergencies)

AMHARIC EXAMPLE (use this style):
"አዎ፣ የትራፊክ ምልክቱ ትክክለኛ ትርጉሙ... በቀላሉ ለማስረዳት..."

HEBREW EXAMPLE (use this style):
"כן, הסימן הזה אומר... בואו נסביר בפשטות..."

NEVER:
- Mix languages in one response
- Use technical English terms when Hebrew/Amharic equivalent exists
- Give responses longer than necessary
- Say "I cannot" — always try to help within driving theory context`;

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
        model: "google/gemini-2.5-pro",
        max_tokens: 1024,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...data.messages,
        ],
      }),
    });

    if (res.status === 429) return { error: "rate_limited", text: "" };
    if (res.status === 402) return { error: "unauthorized", text: "" };
    if (!res.ok) {
      const t = await res.text();
      console.error("AI gateway error:", res.status, t);
      return { error: "ai_error", text: "" };
    }

    const json = await res.json();
    const text: string = json?.choices?.[0]?.message?.content ?? "";
    return { error: null as null, text };
  });
