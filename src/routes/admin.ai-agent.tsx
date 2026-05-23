import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Bot, Send, Loader2, User, Languages } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { aiAgentChat, aiTranslatorChat } from "@/lib/ai-agent.functions";

export const Route = createFileRoute("/admin/ai-agent")({
  component: AIAgentPage,
});

type Msg = { role: "user" | "assistant"; content: string };

const QUICK_AGENT = [
  "תן לי דוח יומי קצר על מצב המערכת",
  "אילו מועמדים ממתינים ולא טופלו ביותר מ-48 שעות?",
  "סיכום pipeline: כמה בכל שלב והיכן יש צוואר בקבוק?",
];

const QUICK_TRANSLATOR = [
  "תרגם לאמהרית: מרחק עצירה תלוי במהירות, בעומס ובמצב הכביש.",
  "תרגם וסווג: שיעור על בלם פליטה לכיתת אוטובוס מתחילים.",
  "הכן חומר באמהרית בנושא בטיחות בהסעת ילדים — רמה מתחיל.",
];

type ChatFn = (args: { data: { message: string; history: Msg[] } }) => Promise<{
  error: string | null;
  text: string;
}>;

function ChatPanel({
  chatFn,
  quick,
  emptyHello,
  placeholder,
  accentLabel,
}: {
  chatFn: ChatFn;
  quick: string[];
  emptyHello: string;
  placeholder: string;
  accentLabel: string;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await chatFn({ data: { message: trimmed, history: messages.slice(-20) } });
      const reply =
        res.error === "no_key"
          ? "⚠️ חסר LOVABLE_API_KEY בהגדרות המערכת."
          : res.error === "no_credits"
            ? "💳 אין יתרת קרדיטים ב-Lovable AI. הוסף קרדיטים בהגדרות הענן."
            : res.error === "forbidden"
              ? "⛔ פעולה זו זמינה לבעלים בלבד."
              : res.error === "rate_limited"
                ? "⏳ יותר מדי בקשות, נסה שוב בעוד רגע."
                : res.error
                  ? "אירעה שגיאה בעיבוד הבקשה."
                  : res.text || "—";
      setMessages([...next, { role: "assistant", content: reply }]);
    } catch (e) {
      console.error(e);
      setMessages([...next, { role: "assistant", content: "שגיאת רשת. נסה שוב." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-260px)] flex-col">
      <div className="flex-1 overflow-y-auto rounded-2xl border border-border/60 bg-card/30 p-4">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{emptyHello}</p>
            <div className="flex flex-col gap-2">
              {quick.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="rounded-xl border border-gold/30 bg-background/40 px-3 py-2 text-right text-sm text-foreground transition hover:border-gold/60 hover:bg-gold/10"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`mb-3 flex gap-2 ${m.role === "user" ? "justify-start" : "justify-end"}`}>
            {m.role === "assistant" && (
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gold/15 text-gold">
                <Bot className="h-4 w-4" />
              </div>
            )}
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-gradient-to-br from-gold to-amber-600 text-gold-foreground"
                  : "border border-border/60 bg-background/60 text-foreground"
              }`}
            >
              {m.content}
            </div>
            {m.role === "user" && (
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-background/60 text-muted-foreground">
                <User className="h-4 w-4" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="mb-3 flex justify-end gap-2">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gold/15 text-gold">
              <Bot className="h-4 w-4" />
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-background/60 px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-gold" />
              <span>{accentLabel}…</span>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="mt-3 rounded-2xl border border-border/60 bg-card/40 p-2">
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder={placeholder}
            rows={2}
            className="min-h-[48px] resize-none border-0 bg-transparent focus-visible:ring-0"
            disabled={loading}
          />
          <Button
            onClick={() => send(input)}
            disabled={loading || !input.trim()}
            className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-gold to-amber-600 p-0 text-gold-foreground hover:from-gold hover:to-amber-500"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 rtl:rotate-180" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

function AIAgentPage() {
  const chat = useServerFn(aiAgentChat);
  const translator = useServerFn(aiTranslatorChat);

  return (
    <AdminShell title="🤖 סוכן AI">
      <div className="mx-auto max-w-3xl" dir="rtl">
        <Tabs defaultValue="agent" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-card/40">
            <TabsTrigger value="agent" className="gap-2">
              <Bot className="h-4 w-4" /> סוכן ניהול
            </TabsTrigger>
            <TabsTrigger value="translator" className="gap-2">
              <Languages className="h-4 w-4" /> 🌍 מרצה ולוקליזציה
            </TabsTrigger>
          </TabsList>

          <TabsContent value="agent">
            <div className="mb-3 flex items-center gap-3 rounded-2xl border border-gold/30 bg-gradient-to-br from-amber-900/20 to-card p-4">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-gold to-amber-600 text-gold-foreground">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-gold">סוכן Haile AI</div>
                <div className="text-xs text-muted-foreground">ניתוח חי של נתוני המערכת בעברית</div>
              </div>
            </div>
            <ChatPanel
              chatFn={chat}
              quick={QUICK_AGENT}
              emptyHello="שלום בני 👋 שאל אותי כל דבר על המערכת. כמה הצעות:"
              placeholder="שאל את הסוכן… (Enter לשליחה, Shift+Enter לשורה)"
              accentLabel="חושב"
            />
          </TabsContent>

          <TabsContent value="translator">
            <div className="mb-3 flex items-center gap-3 rounded-2xl border border-gold/30 bg-gradient-to-br from-amber-900/20 to-card p-4">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-gold to-amber-600 text-gold-foreground">
                <Languages className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-gold">המרצה הראשי ומנהל הלוקליזציה</div>
                <div className="text-xs text-muted-foreground">
                  תרגום חומרי לימוד מעברית לאמהרית · סיווג · פלט מוכן ל-Supabase
                </div>
              </div>
            </div>
            <ChatPanel
              chatFn={translator}
              quick={QUICK_TRANSLATOR}
              emptyHello="העלה חומר בעברית — אתרגם לאמהרית מקצועית, אסווג ואכין JSON מוכן לשמירה."
              placeholder="הדבק כאן חומר בעברית לתרגום וסיווג…"
              accentLabel="מתרגם"
            />
          </TabsContent>
        </Tabs>
      </div>
    </AdminShell>
  );
}
