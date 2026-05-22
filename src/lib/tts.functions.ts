import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const VOICES: Record<string, string> = {
  he: "EXAVITQu4vr4xnSDxMaL", // Sarah
  am: "pNInz6obpgDQGcFmaJgB", // Adam
  ru: "ErXwobaYiN019PkySvjV", // Antoni
  ku: "EXAVITQu4vr4xnSDxMaL",
  en: "EXAVITQu4vr4xnSDxMaL",
};

export const ttsElevenLabs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      text: z.string().min(1).max(2000),
      language: z.enum(["he", "am", "ru", "ku", "en"]).default("he"),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) return { error: "no_key" as const, audio: "" };

    const voiceId = VOICES[data.language] || VOICES.he;
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: data.text,
          model_id: "eleven_v3",
          voice_settings: { stability: 0.5, similarity_boost: 0.8 },
        }),
      },
    );

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      console.error("ElevenLabs TTS error:", res.status, t);
      return { error: "tts_error" as const, audio: "" };
    }

    const buf = await res.arrayBuffer();
    const audio = Buffer.from(buf).toString("base64");
    return { error: null, audio };
  });
