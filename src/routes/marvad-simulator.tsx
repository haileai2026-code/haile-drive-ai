import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Brain, Lock, Trophy, Activity, Target, MessageCircle, ChevronRight, RotateCcw } from "lucide-react";

export const Route = createFileRoute("/marvad-simulator")({
  head: () => ({ meta: [{ title: "סימולטור מרב\"ד — Haile Drive AI" }] }),
  component: MarvadSimulatorPage,
});

type Stage = "intro" | "mmpi" | "cpt" | "atavt" | "interview" | "results";

// ===== MMPI Questions (HE + AM) =====
const MMPI_QUESTIONS: Array<{
  id: string;
  he: string;
  am: string;
  options: Array<{ he: string; am: string; score: number }>;
  isLieDetector?: boolean;
}> = [
  {
    id: "q1",
    he: "אני מרגיש שאנשים מבינים אותי היטב.",
    am: "ሰዎች በሚገባ እንደሚረዱኝ ይሰማኛል።",
    options: [
      { he: "תמיד", am: "ሁልጊዜ", score: 4 },
      { he: "לעיתים קרובות", am: "ብዙ ጊዜ", score: 3 },
      { he: "לפעמים", am: "አንዳንዴ", score: 2 },
      { he: "לעולם לא", am: "በፍፁም", score: 1 },
    ],
  },
  {
    id: "q2",
    he: "מעולם לא שיקרתי, אפילו לא במשהו קטן.",
    am: "በትንሽ ነገር እንኳ ዋሽቼ አላውቅም።",
    isLieDetector: true,
    options: [
      { he: "נכון לחלוטין", am: "ሙሉ በሙሉ እውነት", score: 0 },
      { he: "נכון בדרך כלל", am: "በአብዛኛው እውነት", score: 2 },
      { he: "לא נכון", am: "እውነት አይደለም", score: 4 },
    ],
  },
  {
    id: "q3",
    he: "אני מסוגל להתמודד עם לחץ ביום-יום.",
    am: "የእለት ተእለት ጫናን መቋቋም እችላለሁ።",
    options: [
      { he: "תמיד", am: "ሁልጊዜ", score: 4 },
      { he: "לרוב", am: "በአብዛኛው", score: 3 },
      { he: "מדי פעם", am: "አልፎ አልፎ", score: 2 },
      { he: "כמעט אף פעם", am: "በፍፁም ማለት ይቻላል", score: 1 },
    ],
  },
  {
    id: "q4",
    he: "אני ישן טוב בלילה.",
    am: "ሌሊት በደንብ እተኛለሁ።",
    options: [
      { he: "תמיד", am: "ሁልጊዜ", score: 4 },
      { he: "לרוב", am: "በአብዛኛው", score: 3 },
      { he: "לפעמים", am: "አንዳንዴ", score: 2 },
      { he: "כמעט אף פעם", am: "በፍፁም ማለት ይቻላል", score: 1 },
    ],
  },
  {
    id: "q5",
    he: "אני אף פעם לא כועס על אף אחד.",
    am: "በማንም ላይ ተናድጄ አላውቅም።",
    isLieDetector: true,
    options: [
      { he: "נכון לחלוטין", am: "ሙሉ በሙሉ እውነት", score: 0 },
      { he: "נכון לרוב", am: "በአብዛኛው እውነት", score: 2 },
      { he: "לא נכון", am: "እውነት አይደለም", score: 4 },
    ],
  },
];

// ===== Interview =====
const INTERVIEW = [
  {
    id: "i1",
    q: "ספר לי על מצב לחץ שחווית לאחרונה. איך התמודדת?",
    opts: [
      { text: "פעלתי באימפולסיביות וניסיתי לסיים מהר", trait: "impulsivity", w: -10 },
      { text: "עצרתי, נשמתי עמוק וחשבתי לפני שפעלתי", trait: "selfControl", w: +15 },
      { text: "פניתי לעזרה ושיתפתי מישהו קרוב", trait: "social", w: +10 },
    ],
  },
  {
    id: "i2",
    q: "מה אתה מרגיש כשנהג אחר חותך אותך בכביש?",
    opts: [
      { text: "כועס מאוד ורוצה להגיב", trait: "aggression", w: -15 },
      { text: "מתעצבן רגע אבל ממשיך הלאה", trait: "balanced", w: +10 },
      { text: "לא אכפת לי, אני נשאר רגוע", trait: "calm", w: +15 },
    ],
  },
  {
    id: "i3",
    q: "מה הסיבה האמיתית שלך לרצות להיות נהג?",
    opts: [
      { text: "כסף ופרנסה בלבד", trait: "extrinsic", w: 0 },
      { text: "אהבה לכביש ועצמאות", trait: "intrinsic", w: +15 },
      { text: "אין לי ברירה אחרת", trait: "noChoice", w: -10 },
    ],
  },
  {
    id: "i4",
    q: "איך אתה מגיב לביקורת מהמנהל שלך?",
    opts: [
      { text: "מתגונן ומסביר את עצמי", trait: "defensive", w: -5 },
      { text: "מקשיב ומנסה להשתפר", trait: "growth", w: +15 },
      { text: "מקבל אבל בפנים נפגע", trait: "internalize", w: +5 },
    ],
  },
];

function MarvadSimulatorPage() {
  const { user } = useAuth();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [stage, setStage] = useState<Stage>("intro");
  const [lang, setLang] = useState<"he" | "am">("he");

  // Scores
  const [mmpiScore, setMmpiScore] = useState(0);
  const [mmpiLieFlag, setMmpiLieFlag] = useState(false);
  const [cptResults, setCptResults] = useState<{ rtMean: number; rtSd: number; omissions: number; commissions: number; score: number } | null>(null);
  const [atavtResults, setAtavtResults] = useState<{ score: number; trials: number[] } | null>(null);
  const [interviewScore, setInterviewScore] = useState(0);
  const [interviewNotes, setInterviewNotes] = useState<string[]>([]);

  const [finalScore, setFinalScore] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Check access
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: profile } = await supabase.from("profiles").select("email").eq("id", user.id).maybeSingle();
      const email = profile?.email?.toLowerCase();
      if (!email) { setHasAccess(false); return; }
      const { data: candidate } = await supabase
        .from("candidates")
        .select("beqa_access")
        .ilike("email", email)
        .maybeSingle();
      setHasAccess(!!candidate?.beqa_access);
    })();
  }, [user]);

  const compute = (cpt: typeof cptResults, atavt: typeof atavtResults, interview: number, mmpi: number, lieFlag: boolean) => {
    const mmpiPct = Math.min(100, (mmpi / (MMPI_QUESTIONS.length * 4)) * 100);
    const interviewPct = Math.min(100, Math.max(0, 50 + interview));
    const cptPct = cpt?.score ?? 0;
    const atavtPct = atavt?.score ?? 0;
    const errors = (cpt?.omissions ?? 0) + (cpt?.commissions ?? 0);
    let total = mmpiPct * 0.2 + interviewPct * 0.4 + cptPct * 0.2 + atavtPct * 0.1 - errors * 2;
    if (lieFlag) total -= 10;
    return Math.max(0, Math.min(100, Math.round(total)));
  };

  const handleFinish = async (cpt: typeof cptResults, atavt: typeof atavtResults, intScore: number, mmpi: number, lieFlag: boolean) => {
    const score = compute(cpt, atavt, intScore, mmpi, lieFlag);
    setFinalScore(score);
    setStage("results");
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("beqa_diagnostic_sessions").insert({
      student_id: user.id,
      assessment_type: "marvad_simulator",
      psychological_score: Math.min(100, Math.max(0, 50 + intScore)),
      accuracy_score: Math.min(100, (mmpi / (MMPI_QUESTIONS.length * 4)) * 100),
      final_beqa_score: score,
      end_time: new Date().toISOString(),
      metadata: {
        rt_mean: cpt?.rtMean ?? null,
        rt_sd: cpt?.rtSd ?? null,
        omissions: cpt?.omissions ?? 0,
        commissions: cpt?.commissions ?? 0,
        atavt_scores: atavt?.trials ?? [],
        mmpi_lie_flag: lieFlag,
        interview_notes: interviewNotes,
      },
    });
    setSaving(false);
    if (error) toast.error("שגיאה בשמירת התוצאות: " + error.message);
    else toast.success("התוצאות נשמרו בהצלחה");
  };

  if (hasAccess === null) {
    return (
      <AppShell>
        <div className="py-20 text-center text-muted-foreground">טוען…</div>
      </AppShell>
    );
  }

  if (!hasAccess) {
    return (
      <AppShell>
        <div className="mx-auto mt-12 max-w-md rounded-3xl border border-gold/40 bg-gradient-to-br from-amber-900/30 to-card p-8 text-center shadow-[var(--shadow-gold)]">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gold/15 text-gold">
            <Lock className="h-8 w-8" />
          </div>
          <h1 className="mt-4 text-2xl font-black">סימולטור מרב"ד נעול</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            גישה לסימולטור מרב"ד מלא בתשלום נפרד של <span className="font-bold text-gold">1,200 ₪</span>.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            פנה להנהלת הקמפוס לפרטים והפעלה.
          </p>
          <Link to="/dashboard" className="mt-6 inline-block rounded-xl bg-gold px-5 py-2 text-sm font-bold text-gold-foreground">
            חזרה לדשבורד
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div dir="rtl" className="space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-gold">סימולטור מרב"ד</p>
            <h1 className="text-2xl font-black">אבחון פסיכוטכני מלא 🧠</h1>
          </div>
          <Badge variant="outline" className="border-gold/40 text-gold">
            {stage === "intro" ? "התחלה" : stage === "mmpi" ? "1/4" : stage === "cpt" ? "2/4" : stage === "atavt" ? "3/4" : stage === "interview" ? "4/4" : "סיום"}
          </Badge>
        </header>

        {stage === "intro" && (
          <IntroScreen lang={lang} setLang={setLang} onStart={() => setStage("mmpi")} />
        )}

        {stage === "mmpi" && (
          <MmpiModule
            lang={lang}
            onDone={(score, lie) => {
              setMmpiScore(score);
              setMmpiLieFlag(lie);
              setStage("cpt");
            }}
          />
        )}

        {stage === "cpt" && (
          <CptModule
            onDone={(r) => {
              setCptResults(r);
              setStage("atavt");
            }}
          />
        )}

        {stage === "atavt" && (
          <AtavtModule
            onDone={(r) => {
              setAtavtResults(r);
              setStage("interview");
            }}
          />
        )}

        {stage === "interview" && (
          <InterviewModule
            onDone={(score, notes) => {
              setInterviewScore(score);
              setInterviewNotes(notes);
              handleFinish(cptResults, atavtResults, score, mmpiScore, mmpiLieFlag);
            }}
          />
        )}

        {stage === "results" && finalScore !== null && (
          <ResultsScreen
            finalScore={finalScore}
            mmpi={mmpiScore}
            mmpiLie={mmpiLieFlag}
            cpt={cptResults}
            atavt={atavtResults}
            interview={interviewScore}
            saving={saving}
          />
        )}
      </div>
    </AppShell>
  );
}

// ============================================================
// INTRO
// ============================================================
function IntroScreen({ lang, setLang, onStart }: { lang: "he" | "am"; setLang: (l: "he" | "am") => void; onStart: () => void }) {
  return (
    <Card className="border-gold/30 bg-gradient-to-br from-amber-900/20 to-card">
      <CardContent className="p-6 space-y-5">
        <p className="text-sm text-muted-foreground leading-relaxed">
          ברוך הבא לסימולטור המרב"ד המלא. במהלך האבחון תעבור 4 מודולים:
        </p>
        <ul className="space-y-2 text-sm">
          <li className="flex items-center gap-2"><Brain className="h-4 w-4 text-gold" /> שאלון אישיות MMPI</li>
          <li className="flex items-center gap-2"><Activity className="h-4 w-4 text-gold" /> מבדק קשב CPT</li>
          <li className="flex items-center gap-2"><Target className="h-4 w-4 text-gold" /> אומדן מהירות ATAVT</li>
          <li className="flex items-center gap-2"><MessageCircle className="h-4 w-4 text-gold" /> ראיון עם ד"ר סולומון</li>
        </ul>
        <div className="rounded-xl border border-border/60 bg-background/40 p-3">
          <p className="text-xs text-muted-foreground mb-2">שפת השאלון:</p>
          <div className="flex gap-2">
            <Button size="sm" variant={lang === "he" ? "default" : "outline"} onClick={() => setLang("he")}>עברית</Button>
            <Button size="sm" variant={lang === "am" ? "default" : "outline"} onClick={() => setLang("am")}>አማርኛ</Button>
          </div>
        </div>
        <Button className="w-full bg-gold text-gold-foreground hover:bg-gold/90" onClick={onStart}>
          התחל אבחון <ChevronRight className="mr-2 h-4 w-4 rtl:rotate-180" />
        </Button>
      </CardContent>
    </Card>
  );
}

// ============================================================
// MMPI
// ============================================================
function MmpiModule({ lang, onDone }: { lang: "he" | "am"; onDone: (score: number, lieFlag: boolean) => void }) {
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [lieScore, setLieScore] = useState(0);
  const q = MMPI_QUESTIONS[idx];

  const pick = (s: number) => {
    const newScore = score + s;
    const newLie = lieScore + (q.isLieDetector && s === 0 ? 1 : 0);
    setScore(newScore);
    setLieScore(newLie);
    if (idx + 1 >= MMPI_QUESTIONS.length) {
      onDone(newScore, newLie >= 2);
    } else {
      setIdx(idx + 1);
    }
  };

  return (
    <Card>
      <CardContent className="p-6 space-y-5">
        <div className="flex items-center justify-between">
          <Badge variant="outline">MMPI · {idx + 1}/{MMPI_QUESTIONS.length}</Badge>
          <Progress value={((idx + 1) / MMPI_QUESTIONS.length) * 100} className="w-24" />
        </div>
        <h2 className="text-lg font-bold leading-relaxed">{q[lang]}</h2>
        <div className="space-y-2">
          {q.options.map((o, i) => (
            <button
              key={i}
              onClick={() => pick(o.score)}
              className="w-full rounded-xl border border-border/60 bg-card/40 p-3 text-start text-sm hover:border-gold/60 transition"
            >
              {o[lang]}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// CPT — Continuous Performance Test
// ============================================================
type CptStim = { shape: "square" | "circle" | "triangle"; color: "green" | "red" | "blue"; isTarget: boolean };

function CptModule({ onDone }: { onDone: (r: { rtMean: number; rtSd: number; omissions: number; commissions: number; score: number }) => void }) {
  const [phase, setPhase] = useState<"ready" | "running" | "rest">("ready");
  const [trial, setTrial] = useState(0);
  const [current, setCurrent] = useState<CptStim | null>(null);
  const [prevTarget, setPrevTarget] = useState(false);
  const stimStartRef = useRef<number>(0);
  const respondedRef = useRef(false);
  const rtRef = useRef<number[]>([]);
  const omissionsRef = useRef(0);
  const commissionsRef = useRef(0);
  const TOTAL = 12;

  const generate = (): CptStim => {
    const isTarget = Math.random() < 0.4;
    return {
      shape: isTarget ? "square" : (["circle", "triangle"] as const)[Math.floor(Math.random() * 2)],
      color: isTarget ? "green" : (["red", "blue"] as const)[Math.floor(Math.random() * 2)],
      isTarget,
    };
  };

  useEffect(() => {
    if (phase !== "running") return;
    if (trial >= TOTAL) {
      // finish
      const rts = rtRef.current;
      const rtMean = rts.length ? rts.reduce((a, b) => a + b, 0) / rts.length : 0;
      const variance = rts.length ? rts.reduce((a, b) => a + (b - rtMean) ** 2, 0) / rts.length : 0;
      const rtSd = Math.sqrt(variance);
      const om = omissionsRef.current;
      const cm = commissionsRef.current;
      let score = 100;
      score -= om * 10;
      score -= cm * 8;
      if (rtMean > 600) score -= 10;
      score = Math.max(0, Math.min(100, score));
      onDone({ rtMean: Math.round(rtMean), rtSd: Math.round(rtSd), omissions: om, commissions: cm, score });
      return;
    }
    const s = generate();
    // No repeats: if both current and previous are target, skip target
    const finalStim = s.isTarget && prevTarget ? { shape: "circle" as const, color: "red" as const, isTarget: false } : s;
    setCurrent(finalStim);
    setPrevTarget(finalStim.isTarget);
    respondedRef.current = false;
    stimStartRef.current = performance.now();
    const t1 = setTimeout(() => {
      // stim disappears
      setCurrent(null);
      // ISI
      const t2 = setTimeout(() => {
        if (finalStim.isTarget && !respondedRef.current) omissionsRef.current += 1;
        setTrial((x) => x + 1);
      }, 500);
      // store t2 cleanup
      (t1 as unknown as { _t2?: ReturnType<typeof setTimeout> })._t2 = t2;
    }, 900);
    return () => {
      clearTimeout(t1);
      const t2 = (t1 as unknown as { _t2?: ReturnType<typeof setTimeout> })._t2;
      if (t2) clearTimeout(t2);
    };
  }, [phase, trial, prevTarget, onDone]);

  useEffect(() => {
    if (phase !== "running") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      e.preventDefault();
      if (!current || respondedRef.current) return;
      respondedRef.current = true;
      const rt = performance.now() - stimStartRef.current;
      if (current.isTarget) {
        rtRef.current.push(rt);
      } else {
        commissionsRef.current += 1;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, current]);

  if (phase === "ready") {
    return (
      <Card>
        <CardContent className="p-6 space-y-4 text-center">
          <Activity className="mx-auto h-10 w-10 text-gold" />
          <h2 className="text-xl font-bold">מבדק CPT — קשב מתמשך</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            יוצגו לך צורות צבעוניות. לחץ <kbd className="rounded bg-muted px-2 py-1 text-xs">SPACE</kbd> רק כשרואה <span className="font-bold text-emerald-400">ריבוע ירוק</span>.
            אל תלחץ אם הופיע ריבוע ירוק ברצף פעמיים.
          </p>
          <Button className="bg-gold text-gold-foreground" onClick={() => setPhase("running")}>התחל</Button>
        </CardContent>
      </Card>
    );
  }

  const colorMap = { green: "bg-emerald-500", red: "bg-red-500", blue: "bg-blue-500" };
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <Badge>CPT · {trial + 1}/{TOTAL}</Badge>
          <Progress value={((trial + 1) / TOTAL) * 100} className="w-24" />
        </div>
        <div className="grid place-items-center h-80 bg-background/40 rounded-2xl">
          {current ? (
            current.shape === "square" ? (
              <div className={`h-32 w-32 ${colorMap[current.color]} rounded-lg`} />
            ) : current.shape === "circle" ? (
              <div className={`h-32 w-32 ${colorMap[current.color]} rounded-full`} />
            ) : (
              <div className="h-0 w-0" style={{
                borderLeft: "64px solid transparent",
                borderRight: "64px solid transparent",
                borderBottom: `110px solid ${current.color === "red" ? "#ef4444" : current.color === "blue" ? "#3b82f6" : "#10b981"}`,
              }} />
            )
          ) : (
            <span className="text-3xl text-muted-foreground">+</span>
          )}
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">לחץ SPACE על ריבוע ירוק שלא הופיע ברצף</p>
      </CardContent>
    </Card>
  );
}

// ============================================================
// ATAVT — speed estimation
// ============================================================
function AtavtModule({ onDone }: { onDone: (r: { score: number; trials: number[] }) => void }) {
  const [phase, setPhase] = useState<"ready" | "moving" | "guess" | "feedback">("ready");
  const [trial, setTrial] = useState(0);
  const [ballX, setBallX] = useState(0);
  const [hiddenAt, setHiddenAt] = useState(0);
  const [guessX, setGuessX] = useState(50);
  const [actualX, setActualX] = useState(0);
  const scoresRef = useRef<number[]>([]);
  const TOTAL = 5;
  const trackRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const speedRef = useRef<number>(0);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startTrial = () => {
    const speed = 40 + Math.random() * 60; // % per second
    speedRef.current = speed;
    startTimeRef.current = performance.now();
    setBallX(0);
    setPhase("moving");

    const tick = () => {
      const elapsed = (performance.now() - startTimeRef.current) / 1000;
      const x = elapsed * speed;
      setBallX(Math.min(100, x));
      if (x < 100) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    const hideAfter = 600 + Math.random() * 800;
    hideTimeoutRef.current = setTimeout(() => {
      cancelAnimationFrame(rafRef.current);
      const elapsed = (performance.now() - startTimeRef.current) / 1000;
      const currentX = Math.min(100, elapsed * speed);
      setHiddenAt(currentX);
      // continue invisible motion projection — show after SPACE
      setPhase("guess");
    }, hideAfter);
  };

  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current);
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
  }, []);

  useEffect(() => {
    if (phase !== "guess") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      e.preventDefault();
      const elapsed = (performance.now() - startTimeRef.current) / 1000;
      const actual = Math.min(100, elapsed * speedRef.current);
      setActualX(actual);
      const error = Math.abs(actual - guessX);
      const score = Math.max(0, 100 - error * 2);
      scoresRef.current.push(score);
      setPhase("feedback");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, guessX]);

  const next = () => {
    if (trial + 1 >= TOTAL) {
      const avg = scoresRef.current.reduce((a, b) => a + b, 0) / scoresRef.current.length;
      onDone({ score: Math.round(avg), trials: scoresRef.current.map((s) => Math.round(s)) });
      return;
    }
    setTrial(trial + 1);
    setGuessX(50);
    startTrial();
  };

  if (phase === "ready") {
    return (
      <Card>
        <CardContent className="p-6 space-y-4 text-center">
          <Target className="mx-auto h-10 w-10 text-gold" />
          <h2 className="text-xl font-bold">ATAVT — אומדן מהירות</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            כדור ינוע על מסלול וייעלם. נחש את מיקומו בזמן הלחיצה. הזז את הסמן ולחץ <kbd className="rounded bg-muted px-2 py-1 text-xs">SPACE</kbd>.
          </p>
          <Button className="bg-gold text-gold-foreground" onClick={() => { startTrial(); }}>התחל</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <Badge>ATAVT · {trial + 1}/{TOTAL}</Badge>
          <Progress value={((trial + 1) / TOTAL) * 100} className="w-24" />
        </div>

        <div ref={trackRef} className="relative h-24 rounded-full bg-background/40 border border-border/60 overflow-hidden">
          {phase === "moving" && (
            <div className="absolute top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-gold shadow-[var(--shadow-gold)]" style={{ left: `calc(${ballX}% - 20px)` }} />
          )}
          {phase === "guess" && (
            <>
              <div className="absolute top-0 bottom-0 w-0.5 bg-gold/70" style={{ left: `${guessX}%` }} />
              <div className="absolute top-1/2 -translate-y-1/2 h-8 w-8 rounded-full border-2 border-gold bg-transparent" style={{ left: `calc(${guessX}% - 16px)` }} />
            </>
          )}
          {phase === "feedback" && (
            <>
              <div className="absolute top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-emerald-500" style={{ left: `calc(${actualX}% - 20px)` }} />
              <div className="absolute top-0 bottom-0 w-0.5 bg-red-400" style={{ left: `${guessX}%` }} />
            </>
          )}
        </div>

        {phase === "guess" && (
          <>
            <input type="range" min={0} max={100} value={guessX} onChange={(e) => setGuessX(Number(e.target.value))} className="w-full" />
            <p className="text-center text-xs text-muted-foreground">לחץ SPACE כדי לאשר את המיקום</p>
          </>
        )}
        {phase === "feedback" && (
          <div className="text-center space-y-3">
            <p className="text-sm">
              שגיאה: <span className="font-bold text-gold">{Math.abs(actualX - guessX).toFixed(1)}%</span> · ניקוד: <span className="font-bold text-emerald-400">{Math.round(scoresRef.current[scoresRef.current.length - 1])}</span>
            </p>
            <Button onClick={next} className="bg-gold text-gold-foreground">
              {trial + 1 >= TOTAL ? "סיים" : "המשך"} <ChevronRight className="mr-2 h-4 w-4 rtl:rotate-180" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// INTERVIEW — Dr. Solomon
// ============================================================
function InterviewModule({ onDone }: { onDone: (score: number, notes: string[]) => void }) {
  const [idx, setIdx] = useState(0);
  const [total, setTotal] = useState(0);
  const [notes, setNotes] = useState<string[]>([]);
  const q = INTERVIEW[idx];

  const pick = (w: number, trait: string, text: string) => {
    const newTotal = total + w;
    const newNotes = [...notes, `${q.id}: ${trait} (${text})`];
    setTotal(newTotal);
    setNotes(newNotes);
    if (idx + 1 >= INTERVIEW.length) onDone(newTotal, newNotes);
    else setIdx(idx + 1);
  };

  return (
    <Card className="border-gold/30">
      <CardContent className="p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-gold/20 text-gold text-xl">🧑‍⚕️</div>
          <div>
            <div className="text-sm font-bold">ד"ר סולומון</div>
            <div className="text-[11px] text-muted-foreground">פסיכולוג קליני · ראיון מובנה</div>
          </div>
          <Badge variant="outline" className="ms-auto">{idx + 1}/{INTERVIEW.length}</Badge>
        </div>
        <div className="rounded-2xl bg-background/40 border border-border/60 p-4">
          <p className="text-sm leading-relaxed">{q.q}</p>
        </div>
        <div className="space-y-2">
          {q.opts.map((o, i) => (
            <button
              key={i}
              onClick={() => pick(o.w, o.trait, o.text)}
              className="w-full rounded-xl border border-border/60 bg-card/40 p-3 text-start text-sm hover:border-gold/60 transition"
            >
              {o.text}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// RESULTS
// ============================================================
function ResultsScreen({
  finalScore, mmpi, mmpiLie, cpt, atavt, interview, saving,
}: {
  finalScore: number;
  mmpi: number;
  mmpiLie: boolean;
  cpt: { rtMean: number; rtSd: number; omissions: number; commissions: number; score: number } | null;
  atavt: { score: number; trials: number[] } | null;
  interview: number;
  saving: boolean;
}) {
  const verdict = finalScore >= 75 ? "מוכן לגיוס" : finalScore >= 55 ? "תקין עם מקום לשיפור" : "ממליצים על אימון נוסף";
  const verdictClr = finalScore >= 75 ? "text-emerald-400" : finalScore >= 55 ? "text-amber-300" : "text-red-400";

  return (
    <div className="space-y-4">
      <Card className="border-gold/40 bg-gradient-to-br from-amber-900/30 to-card shadow-[var(--shadow-gold)]">
        <CardContent className="p-6 text-center space-y-3">
          <Trophy className="mx-auto h-10 w-10 text-gold" />
          <div className="text-xs uppercase tracking-wider text-gold/80">Haile Score</div>
          <div className="text-6xl font-black text-gradient-gold">{finalScore}</div>
          <div className={`text-sm font-bold ${verdictClr}`}>{verdict}</div>
          {saving && <p className="text-xs text-muted-foreground">שומר תוצאות…</p>}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5 space-y-3">
          <h3 className="font-bold">פירוט תוצאות</h3>
          <Row label="MMPI אישיות" value={`${Math.round((mmpi / (MMPI_QUESTIONS.length * 4)) * 100)}%`} />
          {mmpiLie && <p className="text-xs text-red-400">⚠️ זוהו תשובות לא עקביות במדד אמינות</p>}
          <Row label="CPT — קשב" value={`${cpt?.score ?? 0}% · RT ${cpt?.rtMean ?? 0}ms`} />
          <Row label="CPT — שגיאות" value={`${(cpt?.omissions ?? 0) + (cpt?.commissions ?? 0)}`} />
          <Row label="ATAVT — אומדן מהירות" value={`${atavt?.score ?? 0}%`} />
          <Row label="ראיון פסיכולוגי" value={`${Math.min(100, Math.max(0, 50 + interview))}%`} />
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Link to="/dashboard" className="flex-1">
          <Button variant="outline" className="w-full">חזרה לדשבורד</Button>
        </Link>
        <Button onClick={() => window.location.reload()} className="flex-1 bg-gold text-gold-foreground">
          <RotateCcw className="me-2 h-4 w-4" /> אבחון נוסף
        </Button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/40 py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}
