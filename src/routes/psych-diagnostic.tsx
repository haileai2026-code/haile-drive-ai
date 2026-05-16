import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/psych-diagnostic")({
  head: () => ({ meta: [{ title: "אבחון פסיכולוגי-תעסוקתי — Haile Drive AI" }] }),
  component: PsychDiagnosticPage,
});

type Community = "ethiopian" | "russian" | "manashe";
type Opt = { he: string; am?: string; score: number };
type Q = {
  id: string;
  category: "motivation" | "self_control" | "safety" | "communication" | "stability" | "pressure" | "community";
  text: { he: string; am?: string };
  options: Opt[];
};

const COMMON: Q[] = [
  { id: "q1", category: "motivation", text: { he: "למה בחרת להיות נהג אוטובוס?", am: "ለምን አውቶቡስ ሹፌር ለመሆን መረጥክ?" }, options: [
    { he: "זה הדבר היחיד שמצאתי", score: 1 },
    { he: "הכסף טוב", score: 2 },
    { he: "אני אוהב לנהוג ולעזור לאנשים", score: 4 },
    { he: "זה מקצוע יציב עם עתיד", score: 3 },
  ]},
  { id: "q2", category: "self_control", text: { he: "נוסע צועק עליך — מה אתה עושה?", am: "ተሳፋሪ ይጮኻል — ምን ታደርጋለህ?" }, options: [
    { he: "צועק בחזרה", score: 1 },
    { he: "מתעלם", score: 2 },
    { he: "עוצר ומסביר בשקט", score: 4 },
    { he: "מתנצל ומרגיע", score: 3 },
  ]},
  { id: "q3", category: "safety", text: { he: "מצאת תקלה ברכב לפני יציאה — מה אתה עושה?" }, options: [
    { he: "יוצא בכל זאת", score: 1 },
    { he: "מדווח אבל יוצא", score: 2 },
    { he: "מדווח ומחכה לאישור", score: 4 },
    { he: "לא יוצא ללא תיקון", score: 4 },
  ]},
  { id: "q4", category: "safety", text: { he: "כמה שעות נהיגה ברצף מותר?" }, options: [
    { he: "כמה שצריך", score: 1 },
    { he: "6-8 שעות", score: 2 },
    { he: "עד 4.5 שעות לפי החוק", score: 4 },
    { he: "תלוי במצב", score: 2 },
  ]},
  { id: "q5", category: "motivation", text: { he: "נכשלת במבחן — מה אתה עושה?" }, options: [
    { he: "מוותר", score: 1 },
    { he: "מחכה הרבה זמן", score: 2 },
    { he: "מנסה שוב אחרי מנוחה", score: 3 },
    { he: "מבין מה לא עבד ומנסה", score: 4 },
  ]},
  { id: "q6", category: "stability", text: { he: "המשפחה תומכת שתהיה נהג אוטובוס?" }, options: [
    { he: "לא, נגד", score: 1 },
    { he: "לא בטוח", score: 2 },
    { he: "כן, עם חששות", score: 3 },
    { he: "כן, לגמרי", score: 4 },
  ]},
  { id: "q7", category: "communication", text: { he: "לא הבנת הוראה בעברית — מה אתה עושה?" }, options: [
    { he: "מעמיד פנים שהבנת", score: 1 },
    { he: "עושה מה שנראה נכון", score: 2 },
    { he: "שואל חבר אחר כך", score: 3 },
    { he: "מבקש הסבר מיד", score: 4 },
  ]},
  { id: "q8", category: "motivation", text: { he: "כמה שעות בשבוע מוכן ללמוד תיאוריה?" }, options: [
    { he: "שעה-שעתיים", score: 1 },
    { he: "3-4 שעות", score: 2 },
    { he: "5-7 שעות", score: 3 },
    { he: "כמה שצריך", score: 4 },
  ]},
  { id: "q9", category: "stability", text: { he: "מה השכר שאתה מצפה?" }, options: [
    { he: "מעל 15,000 ₪ מיד", score: 1 },
    { he: "12,000-15,000 ₪", score: 2 },
    { he: "8,000-12,000 ₪", score: 3 },
    { he: "מוכן להתחיל בפחות ולצמוח", score: 4 },
  ]},
  { id: "q10", category: "communication", text: { he: "תאר את עצמך כנהג:" }, options: [
    { he: "מהיר ויעיל", score: 2 },
    { he: "סבלני ומכבד", score: 4 },
    { he: "מקצועי ובטיחותי", score: 4 },
    { he: "אדיב ושירותי", score: 3 },
  ]},
];

const PRESSURE: Q = {
  id: "qp", category: "pressure",
  text: { he: "אתה נוסע עם 40 נוסעים — שמעת צליל מוזר מהמנוע. מה אתה עושה?" },
  options: [
    { he: "ממשיך — כנראה לא חמור", score: 1 },
    { he: "מאט ומגיע לתחנה הבאה", score: 2 },
    { he: "עוצר בצד בבטחה ומדווח", score: 4 },
    { he: "מתקשר למנהל תוך כדי נסיעה", score: 2 },
  ],
};

const BY_COMMUNITY: Record<Community, Q[]> = {
  ethiopian: [
    { id: "qe1", category: "stability", text: { he: "אם לא עברת מבחן — מה תגיד למשפחה?" }, options: [
      { he: "אסתיר", score: 1 }, { he: "אגיד שדחיתי", score: 2 }, { he: "אגיד האמת ואנסה שוב", score: 4 },
    ]},
    { id: "qe2", category: "motivation", text: { he: "פחדת פעם מכישלון ועשית בכל זאת — ספר" }, options: [
      { he: "לא קרה", score: 1 }, { he: "רק אם הייתי חייב", score: 2 }, { he: "כן, תמיד אנסה", score: 4 },
    ]},
    { id: "qe3", category: "stability", text: { he: "אדם שאתה מכבד — מה הוא היה אומר על המקצוע הזה?" }, options: [
      { he: "לא בטוח", score: 1 }, { he: "היה מסכים", score: 3 }, { he: "היה גאה", score: 4 },
    ]},
  ],
  russian: [
    { id: "qr1", category: "motivation", text: { he: "מה עשית מקצועית לפני שהגעת לישראל?" }, options: [
      { he: "לא רלוונטי", score: 1 }, { he: "עבדתי בתחום שונה", score: 2 }, { he: "יש לי ניסיון תחבורה", score: 4 },
    ]},
    { id: "qr2", category: "self_control", text: { he: "מנהל ישראלי ביקש משהו שנראה לך לא נכון — מה תעשה?" }, options: [
      { he: "אתעלם", score: 1 }, { he: "אעשה אבל אתלונן", score: 2 }, { he: "אשאל לפני שאעשה", score: 4 },
    ]},
    { id: "qr3", category: "stability", text: { he: "בעוד 3 שנים — איפה אתה רוצה להיות?" }, options: [
      { he: "לא יודע", score: 1 }, { he: "אותו מקום", score: 2 }, { he: "נהג מנוסה / מדריך", score: 4 },
    ]},
  ],
  manashe: [
    { id: "qm1", category: "motivation", text: { he: "למה בחרת לעלות לישראל?" }, options: [
      { he: "הגעתי עם המשפחה", score: 2 }, { he: "חיפשתי עבודה", score: 2 }, { he: "זה החלום שלי מאז ילדות", score: 4 },
    ]},
    { id: "qm2", category: "stability", text: { he: "מוכן לנסוע כל יום לעיר אחרת?" }, options: [
      { he: "לא", score: 1 }, { he: "רק קרוב לבית", score: 2 }, { he: "כן, בלי בעיה", score: 4 },
    ]},
    { id: "qm3", category: "motivation", text: { he: "ספר על עבודה קשה שעשית בחיים" }, options: [
      { he: "לא עשיתי", score: 1 }, { he: "עבדתי קשה כשהייתי חייב", score: 2 }, { he: "תמיד עבדתי קשה", score: 4 },
    ]},
  ],
};

const COMMUNITY_LABEL: Record<Community, string> = {
  ethiopian: "🇪🇹 אמהרית",
  russian: "🇷🇺 רוסית",
  manashe: "✡️ קוקי (בני מנשה)",
};

// Score weights per spec
function calcScore(answers: Record<string, number>): number {
  const get = (id: string) => answers[id] ?? 0;
  const avg = (ids: string[]) => {
    const vals = ids.map(get).filter((v) => v > 0);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  };
  const motivation = avg(["q1", "q5", "q8"]);
  const selfControl = avg(["q2", "qp"]);
  const safety = avg(["q3", "q4"]);
  const communication = avg(["q7", "q10"]);
  const stability = avg(["q6", "q9"]);
  const score =
    motivation * 0.25 +
    selfControl * 0.25 +
    safety * 0.20 +
    communication * 0.15 +
    stability * 0.15;
  return Math.round(score * 100) / 100;
}

function recommendationFor(score: number): { letter: "A" | "B" | "C"; label: string; color: string; emoji: string } {
  if (score >= 4.0) return { letter: "A", label: "מומלץ מאוד להמשך תהליך", color: "text-emerald-500", emoji: "🟢" };
  if (score >= 3.0) return { letter: "B", label: "מומלץ ראיון נוסף", color: "text-amber-500", emoji: "🟡" };
  return { letter: "C", label: "לא מומלץ כרגע", color: "text-red-500", emoji: "🔴" };
}

function PsychDiagnosticPage() {
  const { user } = useAuth();
  const [community, setCommunity] = useState<Community | null>(null);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<{ score: number; rec: ReturnType<typeof recommendationFor> } | null>(null);

  const questions: Q[] = useMemo(() => {
    if (!community) return [];
    return [...COMMON, PRESSURE, ...BY_COMMUNITY[community]];
  }, [community]);

  const total = questions.length;
  const current = questions[step];
  const progress = total ? Math.round(((step) / total) * 100) : 0;

  const pickAnswer = async (opt: Opt) => {
    if (!current) return;
    const nextAnswers = { ...answers, [current.id]: opt.score };
    setAnswers(nextAnswers);
    if (step + 1 < total) {
      setStep(step + 1);
    } else {
      await finish(nextAnswers);
    }
  };

  const finish = async (final: Record<string, number>) => {
    if (!user || !community) {
      toast.error("צריך להיות מחובר כדי לשמור תוצאה");
      return;
    }
    setSaving(true);
    const score = calcScore(final);
    const rec = recommendationFor(score);
    const { error } = await supabase.from("beqa_diagnostic_sessions").insert({
      student_id: user.id,
      assessment_type: "psychological",
      community_type: community,
      psychological_score: score,
      recommendation: rec.letter,
      answers: final as any,
      end_time: new Date().toISOString(),
      metadata: { recommendation_label: rec.label, version: "psych-v1" } as any,
    });
    setSaving(false);
    if (error) {
      console.error(error);
      toast.error("שמירה נכשלה: " + error.message);
    } else {
      toast.success(`ציון: ${score} — ${rec.label}`);
    }
    setDone({ score, rec });
  };

  const reset = () => {
    setCommunity(null); setStep(0); setAnswers({}); setDone(null);
  };

  // ---- Renders ----
  if (!user) {
    return (
      <AppShell requireAuth={false}>
        <div dir="rtl" className="mx-auto max-w-md py-12 text-center space-y-4">
          <div className="text-5xl">🧠</div>
          <h1 className="text-2xl font-bold">אבחון פסיכולוגי-תעסוקתי</h1>
          <p className="text-sm text-muted-foreground">יש להתחבר כדי לבצע ולשמור את האבחון.</p>
          <Link to="/login"><Button>התחבר</Button></Link>
        </div>
      </AppShell>
    );
  }

  if (done) {
    return (
      <AppShell requireAuth={false}>
        <div dir="rtl" className="mx-auto max-w-md py-12 text-center space-y-6">
          <div className="text-6xl">{done.rec.emoji}</div>
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">ציון BEQA פסיכולוגי</div>
            <div className={`mt-2 text-7xl font-black ${done.rec.color}`}>{done.score.toFixed(2)}</div>
            <div className="mt-2 text-2xl font-bold">מועמד {done.rec.letter}</div>
            <p className="mt-2 text-base text-muted-foreground">{done.rec.label}</p>
          </div>
          <div className="rounded-2xl border bg-card/50 p-4 text-start text-sm space-y-1">
            <div className="font-semibold mb-1">פילוח קטגוריות (1–4):</div>
            {([
              ["מוטיבציה (25%)", ["q1", "q5", "q8"]],
              ["שליטה עצמית (25%)", ["q2", "qp"]],
              ["בטיחות ואחריות (20%)", ["q3", "q4"]],
              ["תקשורת (15%)", ["q7", "q10"]],
              ["יציבות ותמיכה (15%)", ["q6", "q9"]],
            ] as const).map(([name, ids]) => {
              const vals = ids.map((id) => answers[id] ?? 0).filter((v) => v > 0);
              const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
              return <div key={name} className="flex justify-between"><span>{name}</span><span className="font-mono">{avg.toFixed(2)}</span></div>;
            })}
          </div>
          <div className="flex flex-col gap-2">
            <Button onClick={reset} variant="outline">בצע אבחון נוסף</Button>
            <Link to="/dashboard"><Button className="w-full">חזרה לדשבורד</Button></Link>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!community) {
    return (
      <AppShell requireAuth={false}>
        <div dir="rtl" className="mx-auto max-w-md py-10 space-y-6">
          <div className="text-center space-y-2">
            <div className="text-5xl">🧠</div>
            <h1 className="text-2xl font-bold">אבחון פסיכולוגי-תעסוקתי</h1>
            <p className="text-sm text-muted-foreground">לפני שמתחילים — בחר את הקהילה שלך:</p>
          </div>
          <div className="grid gap-3">
            {(Object.keys(COMMUNITY_LABEL) as Community[]).map((c) => (
              <Button
                key={c}
                onClick={() => setCommunity(c)}
                size="lg"
                variant="outline"
                className="h-20 text-xl font-bold hover:bg-primary/10 hover:border-primary"
              >
                {COMMUNITY_LABEL[c]}
              </Button>
            ))}
          </div>
          <p className="text-xs text-center text-muted-foreground">
            14 שאלות · ~5 דקות · התוצאה נשמרת בפרופיל שלך
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell requireAuth={false}>
      <div dir="rtl" className="mx-auto max-w-xl py-6 space-y-5">
        <div>
          <div className="flex justify-between text-xs mb-2">
            <span className="text-muted-foreground">שאלה {step + 1} מתוך {total}</span>
            <span className="text-muted-foreground">{COMMUNITY_LABEL[community]}</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <Card key={current.id} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <CardContent className="p-6 space-y-5">
            <div className="space-y-1">
              <div className="text-lg font-bold leading-snug">{current.text.he}</div>
              {current.text.am && (
                <div className="text-sm text-muted-foreground" lang="am" dir="ltr">{current.text.am}</div>
              )}
            </div>
            <div className="grid gap-2">
              {current.options.map((opt, i) => (
                <Button
                  key={i}
                  onClick={() => pickAnswer(opt)}
                  variant="outline"
                  size="lg"
                  disabled={saving}
                  className="h-auto min-h-14 whitespace-normal text-start justify-start text-base font-medium py-3 px-4 hover:bg-primary/10 hover:border-primary"
                >
                  <span className="me-2 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold">
                    {String.fromCharCode(1488 + i)}
                  </span>
                  <span>{opt.he}</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {step > 0 && (
          <div className="text-center">
            <button onClick={() => setStep(step - 1)} className="text-xs text-muted-foreground hover:underline">
              ← שאלה קודמת
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
