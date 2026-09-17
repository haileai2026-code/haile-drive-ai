export type AiRole = "admin" | "translator" | "tutor";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ChatCompletionError =
  | "no_key"
  | "unauthorized"
  | "no_credits"
  | "rate_limited"
  | "ai_error";

export type ChatCompletionResult =
  | { error: null; text: string }
  | { error: ChatCompletionError; text: string };

function modelForRole(role: AiRole): string {
  switch (role) {
    case "admin":
      return process.env.XAI_MODEL_ADMIN || "grok-4.3";
    case "translator":
      return process.env.XAI_MODEL_TRANSLATOR || "grok-4.6";
    case "tutor":
      return process.env.XAI_MODEL_TUTOR || "grok-4.6";
  }
}

/** Shared xAI chat completions client. No stream, no retries. Never log keys/PII. */
export async function chatCompletion({
  role,
  messages,
  maxTokens,
}: {
  role: AiRole;
  messages: ChatMessage[];
  maxTokens: number;
}): Promise<ChatCompletionResult> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return { error: "no_key", text: "" };

  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: modelForRole(role),
      max_tokens: maxTokens,
      stream: false,
      messages,
    }),
  });

  if (res.status === 401) return { error: "unauthorized", text: "" };
  if (res.status === 402 || res.status === 403) return { error: "no_credits", text: "" };
  if (res.status === 429) return { error: "rate_limited", text: "" };
  if (!res.ok) {
    console.error("xAI chat error", res.status);
    return { error: "ai_error", text: "" };
  }

  const json = await res.json();
  const text: string = json?.choices?.[0]?.message?.content ?? "";
  return { error: null, text };
}
