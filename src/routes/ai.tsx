import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import { AppShell } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { aiChat } from "@/lib/ai-chat.functions";
import { Bot, Mic, MicOff, Send, User, Volume2, VolumeX, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/ai")({
  head: () => ({ meta: [{ title: "AI Teacher — Haile Drive AI" }] }),
  component: AiPage,
});

type Msg = { role: "user" | "assistant"; content: string };

const seed: Msg[] = [
  {
    role: "assistant",
    content:
      "ሰላም! 👋 እኔ Haile AI ነኝ — የመንዳት አስተማሪዎ።\n\nስለ መንዳት፣ **ብሬክ (בלם)**, **የመንገድ ምልክት (תמרור)** ወይም **ቴዎሪ (תיאוריה)** ማንኛውንም ጥያቄ ይጠይቁኝ።",
  },
];

const suggestions = [
  "የአየር ብሬክ እንዴት ይሰራል?",
  "תמרור עצור — מה לעשות?",
  "מהי מהירות מותרת בעיר?",
  "Explain pre-trip inspection",
];

// Detect Amharic (Ethiopic Unicode block) to choose TTS voice/lang
function detectLang(text: string): "am" | "he" | "en" {
  if (/[\u1200-\u137F]/.test(text)) return "am";
  if (/[\u0590-\u05FF]/.test(text)) return "he";
  return "en";
}

export function AiPage() {
  const { t } = useI18n();
  const callAi = useServerFn(aiChat);
  const [msgs, setMsgs] = useState<Msg[]>(seed);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [ttsOn, setTtsOn] = useState(false);
  const recogRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, loading]);

  // Speak assistant text using Web Speech API
  const speak = (text: string) => {
    if (!ttsOn || typeof window === "undefined" || !window.speechSynthesis) return;
    const lang = detectLang(text);
    const utter = new SpeechSynthesisUtterance(text.replace(/[*_#`>[\]()]/g, ""));
    utter.lang = lang === "am" ? "am-ET" : lang === "he" ? "he-IL" : "en-US";
    utter.rate = 0.95;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  };

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setInput("");
    const next: Msg[] = [...msgs, { role: "user", content: trimmed }];
    setMsgs(next);
    setLoading(true);
    try {
      const res = await callAi({ data: { messages: next } });
      if (res.error === "rate_limited") {
        toast.error("יותר מדי בקשות — נסה/י שוב בעוד רגע");
        return;
      }
      if (res.error === "no_credits") {
        toast.error("נגמרו הקרדיטים ב-Lovable AI — הוסף/י credits");
        return;
      }
      if (res.error || !res.text) {
        toast.error("שגיאה בקבלת תשובה מה-AI");
        return;
      }
      setMsgs((m) => [...m, { role: "assistant", content: res.text }]);
      speak(res.text);
    } catch (e) {
      console.error(e);
      toast.error("שגיאה בחיבור ל-AI");
    } finally {
      setLoading(false);
    }
  };

  // Voice input via Web Speech API
  const toggleMic = () => {
    if (typeof window === "undefined") return;
    const SR: any =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast.error("הדפדפן לא תומך בקלט קולי. נסה/י Chrome.");
      return;
    }
    if (listening && recogRef.current) {
      recogRef.current.stop();
      return;
    }
    const recog = new SR();
    // Default to Amharic with Hebrew fallback heuristic — user can re-tap to retry
    recog.lang = "am-ET";
    recog.interimResults = false;
    recog.maxAlternatives = 1;
    recog.continuous = false;
    recog.onresult = (ev: any) => {
      const transcript = ev.results?.[0]?.[0]?.transcript ?? "";
      if (transcript) {
        setInput(transcript);
        // auto-send for fluid voice UX
        setTimeout(() => send(transcript), 50);
      }
    };
    recog.onend = () => setListening(false);
    recog.onerror = (ev: any) => {
      setListening(false);
      if (ev.error === "no-speech") return;
      toast.error(`שגיאת מיקרופון: ${ev.error}`);
    };
    recogRef.current = recog;
    setListening(true);
    try {
      recog.start();
    } catch {
      setListening(false);
    }
  };

  return (
    <AppShell>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-gold to-amber-600 text-gold-foreground shadow-[var(--shadow-gold)]">
            <Bot className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-xl font-black tracking-tight">{t("aiTeacher")}</h1>
            <p className="text-xs text-muted-foreground">አማርኛ • עברית • English</p>
          </div>
        </div>
        <button
          onClick={() => {
            setTtsOn((v) => {
              if (v && typeof window !== "undefined") window.speechSynthesis?.cancel();
              return !v;
            });
          }}
          className={`grid h-10 w-10 place-items-center rounded-full border border-border/70 transition ${
            ttsOn ? "bg-gold text-gold-foreground" : "bg-card text-muted-foreground"
          }`}
          aria-label="Toggle voice output"
          title={ttsOn ? "השתק תשובות קוליות" : "הפעל תשובות קוליות"}
        >
          {ttsOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
        </button>
      </div>

      <div className="space-y-3 pb-4">
        {msgs.map((m, i) => (
          <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            {m.role === "assistant" && (
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gold/15 text-gold">
                <Bot className="h-4 w-4" />
              </span>
            )}
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                m.role === "user"
                  ? "rounded-br-md bg-gold text-gold-foreground"
                  : "rounded-bl-md border border-border/60 bg-card"
              }`}
            >
              {m.role === "assistant" ? (
                <div className="prose prose-sm max-w-none prose-invert prose-p:my-1 prose-ul:my-1 prose-strong:text-gold">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              ) : (
                m.content
              )}
            </div>
            {m.role === "user" && (
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-card text-muted-foreground">
                <User className="h-4 w-4" />
              </span>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Haile AI חושב…
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      <div className="flex flex-wrap gap-2 pb-3">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => send(s)}
            disabled={loading}
            className="rounded-full border border-border/70 bg-card/50 px-3 py-1.5 text-xs text-muted-foreground hover:border-gold/40 hover:text-foreground disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="sticky bottom-24 mt-2 flex items-center gap-2 rounded-full border border-border bg-card/80 px-2 py-2 shadow-[var(--shadow-elev)] backdrop-blur"
      >
        <button
          type="button"
          onClick={toggleMic}
          className={`grid h-10 w-10 place-items-center rounded-full transition ${
            listening
              ? "bg-red-500 text-white animate-pulse"
              : "text-muted-foreground hover:text-gold"
          }`}
          aria-label="Voice input"
        >
          {listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={listening ? "מקשיב…" : t("askAnything")}
          disabled={loading}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="grid h-10 w-10 place-items-center rounded-full bg-gold text-gold-foreground disabled:opacity-50"
          aria-label="Send"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5 rtl:-scale-x-100" />}
        </button>
      </form>
    </AppShell>
  );
}
