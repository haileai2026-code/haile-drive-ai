import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { Bot, Mic, Send, User } from "lucide-react";

export const Route = createFileRoute("/ai")({
  head: () => ({ meta: [{ title: "AI Teacher — Haile Drive AI" }] }),
  component: AiPage,
});

type Msg = { role: "user" | "assistant"; text: string };

const seed: Msg[] = [
  { role: "assistant", text: "ሰላም! እኔ የእርስዎ AI አስተማሪ ነኝ። ስለ መንዳት፣ ብሬክ፣ የመንገድ ምልክቶች ወይም የዕብራይስጥ ቃላት ማንኛውንም ጥያቄ ይጠይቁኝ።" },
];

const suggestions = [
  "የአየር ብሬክ እንዴት ይሰራል?",
  "תמרור עצור — מה לעשות?",
  "Explain pre-trip inspection",
];

export function AiPage() {
  const { t } = useI18n();
  const [msgs, setMsgs] = useState<Msg[]>(seed);
  const [input, setInput] = useState("");

  const send = (text: string) => {
    if (!text.trim()) return;
    setMsgs((m) => [
      ...m,
      { role: "user", text },
      { role: "assistant", text: "ጥሩ ጥያቄ! (Demo) — Lovable Cloud + AI Gateway ሲንቃ ሙሉ መልስ ይኖራል።" },
    ]);
    setInput("");
  };

  return (
    <AppShell>
      <div className="mb-4 flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-gold to-amber-600 text-gold-foreground shadow-[var(--shadow-gold)]">
          <Bot className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-xl font-black tracking-tight">{t("aiTeacher")}</h1>
          <p className="text-xs text-muted-foreground">በትዕግስት የሚያስተምር AI</p>
        </div>
      </div>

      <div className="space-y-3 pb-4">
        {msgs.map((m, i) => (
          <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            {m.role === "assistant" && (
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gold/15 text-gold">
                <Bot className="h-4 w-4" />
              </span>
            )}
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
              m.role === "user" ? "rounded-br-md bg-gold text-gold-foreground" : "rounded-bl-md border border-border/60 bg-card"
            }`}>
              {m.text}
            </div>
            {m.role === "user" && (
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-card text-muted-foreground">
                <User className="h-4 w-4" />
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 pb-3">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => send(s)}
            className="rounded-full border border-border/70 bg-card/50 px-3 py-1.5 text-xs text-muted-foreground hover:border-gold/40 hover:text-foreground"
          >
            {s}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="sticky bottom-24 mt-2 flex items-center gap-2 rounded-full border border-border bg-card/80 px-2 py-2 shadow-[var(--shadow-elev)] backdrop-blur"
      >
        <button type="button" className="grid h-10 w-10 place-items-center rounded-full text-muted-foreground hover:text-gold" aria-label="Voice">
          <Mic className="h-5 w-5" />
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("askAnything")}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
        />
        <button type="submit" className="grid h-10 w-10 place-items-center rounded-full bg-gold text-gold-foreground" aria-label="Send">
          <Send className="h-5 w-5 rtl:-scale-x-100" />
        </button>
      </form>
    </AppShell>
  );
}
