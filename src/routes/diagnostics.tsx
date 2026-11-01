import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Volume2, Heart, Camera, Brain, RotateCcw, Activity } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { createTTS, createFaceAnalysis, createRPPG } from "@/lib/diagnostics/config";
import { BETA_FEATURES, BETA_DISABLED_MESSAGE } from "@/lib/beta-flags";
import type { TTSProvider, FaceAnalysisProvider, RPPGProvider, FaceEmotion } from "@/lib/diagnostics/interfaces";
import { BiometricConsentScreen, hasGrantedBiometricConsent } from "@/components/diagnostics/BiometricConsentScreen";
import { finishDiagnostic } from "@/lib/diagnostics/finish-diagnostic.functions";
import {
  questionsFor, ttsTextFor, LANGUAGE_LABEL, DIAG_LANGUAGES,
  type DiagDisplayLanguage, type DiagQuestion,
} from "@/lib/diagnostics/questions";

export const Route = createFileRoute("/diagnostics")({
  head: () => ({ meta: [{ title: "אבחון מקצועי מאוחד — Haile Drive AI" }] }),
  component: DiagnosticsGate,
});

type Phase = "welcome" | "consent" | "language" | "calibration" | "questions" | "pressure" | "results";

type AnswerRow = {
  qId: string;
  optionIndex: number;
  rtMs: number;
  bpmAtAnswer: number | null;
  hrvAtAnswer: number | null;
};

type BpmPoint = { t: number; bpm: number; hrv: number };
type EmoPoint = { t: number; anxiety: number; focus: number; confidence: number; confusion: number };

const CALIBRATION_SECONDS = 30;
const PRESSURE_SECONDS = 20;

// Closed beta: the heart-rate (rPPG) camera diagnostic is hidden (not removed).
function DiagnosticsGate() {
  if (!BETA_FEATURES.heartRateCamera) {
    return (
      <AppShell>
        <div dir="rtl" className="mx-auto max-w-md py-16 text-center text-sm text-muted-foreground">
          {BETA_DISABLED_MESSAGE}
        </div>
      </AppShell>
    );
  }
  return <DiagnosticsPage />;
}

function DiagnosticsPage() {
  const { user } = useAuth();
  const [beqaAccess, setBeqaAccess] = useState<boolean | null>(null);

  // Streams + providers
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const ttsRef = useRef<TTSProvider | null>(null);
  const faceRef = useRef<FaceAnalysisProvider | null>(null);
  const rppgRef = useRef<RPPGProvider | null>(null);

  // Live state
  const [phase, setPhase] = useState<Phase>("welcome");
  const [lang, setLang] = useState<DiagDisplayLanguage | null>(null);
  const [bpm, setBpm] = useState<number | null>(null);
  const [hrv, setHrv] = useState<number | null>(null);
  const [emotion, setEmotion] = useState<FaceEmotion | null>(null);

  const bpmSeries = useRef<BpmPoint[]>([]);
  const emoSeries = useRef<EmoPoint[]>([]);
  const startTsRef = useRef<number>(0);

  // Calibration
  const [calibLeft, setCalibLeft] = useState(CALIBRATION_SECONDS);
  const [baselineHr, setBaselineHr] = useState<number | null>(null);
  const calibBpms = useRef<number[]>([]);

  // Questions
  const [qIdx, setQIdx] = useState(0);
  const [answers, setAnswers] = useState<AnswerRow[]>([]);
  const questionShownAt = useRef<number>(0);

  // Pressure scenario
  const [pressureLeft, setPressureLeft] = useState(PRESSURE_SECONDS);
  const pressureBpms = useRef<number[]>([]);
  const [stressHr, setStressHr] = useState<number | null>(null);

  const questions = useMemo<DiagQuestion[]>(
    () => (lang ? questionsFor().filter((q) => q.id !== "qp") : []),
    [lang],
  );
  const pressureQ = useMemo<DiagQuestion | null>(
    () => (lang ? questionsFor().find((q) => q.id === "qp") ?? null : null),
    [lang],
  );

  const [done, setDone] = useState(false);
  const sessionId = useRef(crypto.randomUUID());
  const finishFn = useServerFn(finishDiagnostic);

  // ---- BEQA gate ----
  useEffect(() => {
    if (!user) { setBeqaAccess(null); return; }
    (async () => {
      // SECURITY DEFINER helper keyed on candidates.user_id (students have no
      // table access to public.candidates; never match on email).
      const { data } = await supabase.rpc("current_user_has_beqa_access");
      setBeqaAccess(data === true);
    })();
  }, [user]);

  useEffect(() => () => cleanup(), []);

  useEffect(() => {
    if (!streamRef.current || !videoRef.current) return;
    if (videoRef.current.srcObject !== streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.muted = true;
      videoRef.current.playsInline = true;
      videoRef.current.play().catch(() => {});
    }
  }, [phase]);

  function cleanup() {
    try { ttsRef.current?.stop(); } catch {}
    try { faceRef.current?.stopAnalysis(); } catch {}
    try { rppgRef.current?.stopMeasurement(); } catch {}
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function requestCameraAndStart() {
    // Hard gate: never touch the camera without a stored granted consent.
    if (!user) { toast.error("צריך להיות מחובר"); return; }
    const consented = await hasGrantedBiometricConsent(user.id);
    if (!consented) { setPhase("consent"); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
        audio: false,
      });
      streamRef.current = stream;
      setPhase("language");
      // wait for video element
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;
        try { await videoRef.current.play(); } catch {}
      }

      ttsRef.current = createTTS();
      faceRef.current = createFaceAnalysis();
      rppgRef.current = createRPPG();

      faceRef.current.onEmotionDetected = (e) => {
        setEmotion(e);
        emoSeries.current.push({
          t: Math.round((Date.now() - (startTsRef.current || Date.now())) / 1000),
          anxiety: e.anxiety, focus: e.focus, confidence: e.confidence, confusion: e.confusion,
        });
      };
      rppgRef.current.onBPMSample = (b, h) => {
        setBpm(b); setHrv(h);
        bpmSeries.current.push({
          t: Math.round((Date.now() - (startTsRef.current || Date.now())) / 1000),
          bpm: b, hrv: h,
        });
      };
      faceRef.current.startAnalysis(stream);
      rppgRef.current.startMeasurement(stream);
    } catch (e: any) {
      console.error(e);
      toast.error("גישה למצלמה נדחתה. אפשר אותה בהגדרות הדפדפן.");
    }
  }

  function chooseLanguage(c: DiagDisplayLanguage) {
    setLang(c);
    startTsRef.current = Date.now();
    bpmSeries.current = []; emoSeries.current = []; calibBpms.current = [];
    setPhase("calibration");
    setCalibLeft(CALIBRATION_SECONDS);
    ttsRef.current?.speak(
      c === "ru" ? "Сядь удобно. Смотри в камеру. 30 секунд." :
      c === "am" ? "በምቾት ቁጭ በል። ካሜራውን ተመልከት። 30 ሰከንዶች።" :
      "שב בנוחות. הסתכל על המצלמה. 30 שניות.",
      c,
    );
  }

  // Calibration countdown
  useEffect(() => {
    if (phase !== "calibration") return;
    const t = setInterval(() => {
      if (bpm != null) calibBpms.current.push(bpm);
      setCalibLeft((s) => {
        if (s <= 1) {
          clearInterval(t);
          const avg = calibBpms.current.length
            ? Math.round(calibBpms.current.reduce((a, b) => a + b, 0) / calibBpms.current.length)
            : bpm ?? 72;
          setBaselineHr(avg);
          setPhase("questions");
          setQIdx(0);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [phase, bpm]);

  // Speak each question when shown
  useEffect(() => {
    if (phase !== "questions" || !lang || !questions[qIdx]) return;
    questionShownAt.current = Date.now();
    const q = questions[qIdx];
    ttsRef.current?.speak(ttsTextFor(q, lang), lang);
  }, [phase, qIdx, lang, questions]);

  function repeatTTS() {
    if (!lang) return;
    const q = phase === "pressure" ? pressureQ : questions[qIdx];
    if (q) ttsRef.current?.speak(ttsTextFor(q, lang), lang);
  }

  async function pickAnswer(optionIndex: number) {
    const q = phase === "pressure" ? pressureQ : questions[qIdx];
    if (!q) return;
    const row: AnswerRow = {
      qId: q.id,
      optionIndex,
      rtMs: Date.now() - questionShownAt.current,
      bpmAtAnswer: bpm,
      hrvAtAnswer: hrv,
    };
    const next = [...answers, row];
    setAnswers(next);

    if (user) {
      supabase.from("raw_biometric_log").insert({
        student_id: user.id,
        session_id: sessionId.current,
        event_type: "answer_submitted",
        bpm, hrv,
        payload: { q: q.id, option_index: optionIndex, rt_ms: row.rtMs },
      }).then(() => {}, () => {});
    }

    if (phase === "questions") {
      if (qIdx + 1 < questions.length) {
        setQIdx(qIdx + 1);
      } else {
        // begin pressure scenario
        setPhase("pressure");
        setPressureLeft(PRESSURE_SECONDS);
        pressureBpms.current = [];
        questionShownAt.current = Date.now();
        if (lang && pressureQ) {
          ttsRef.current?.speak(ttsTextFor(pressureQ, lang), lang);
        }
      }
    } else {
      await finishAll(next);
    }
  }

  // pressure timer
  useEffect(() => {
    if (phase !== "pressure") return;
    const t = setInterval(() => {
      if (bpm != null) pressureBpms.current.push(bpm);
      setPressureLeft((s) => {
        if (s <= 1) {
          clearInterval(t);
          // timeout = lowest score
          finishAll([...answers, {
            qId: pressureQ?.id ?? "qp",
            optionIndex: 0,
            rtMs: Date.now() - questionShownAt.current,
            bpmAtAnswer: bpm,
            hrvAtAnswer: hrv,
          }]);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  async function finishAll(allAnswers: AnswerRow[]) {
    cleanup();
    const sHr = pressureBpms.current.length
      ? Math.round(pressureBpms.current.reduce((a, b) => a + b, 0) / pressureBpms.current.length)
      : bpm ?? baselineHr;
    setStressHr(sHr);

    if (user && lang) {
      try {
        await finishFn({
          data: {
            lang,
            sessionId: sessionId.current,
            baselineHr,
            stressHr: sHr,
            answers: allAnswers.map((a) => ({
              qId: a.qId,
              optionIndex: a.optionIndex,
              rtMs: a.rtMs,
              bpm: a.bpmAtAnswer,
              hrv: a.hrvAtAnswer,
            })),
          },
        });
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "שמירת האבחון נכשלה");
      }
    }

    setDone(true);
    setPhase("results");
  }

  function reset() {
    cleanup();
    setPhase("welcome");
    setLang(null);
    setAnswers([]);
    setQIdx(0);
    setDone(false);
    sessionId.current = crypto.randomUUID();
    setBpm(null); setHrv(null); setEmotion(null);
    setBaselineHr(null); setStressHr(null);
    bpmSeries.current = []; emoSeries.current = [];
  }

  // ---- gating ----
  if (!user) {
    return (
      <AppShell requireAuth={false}>
        <div dir="rtl" className="mx-auto max-w-md py-12 text-center space-y-4">
          <div className="text-5xl">🧠</div>
          <h1 className="text-2xl font-bold">אבחון מקצועי מאוחד</h1>
          <p className="text-sm text-muted-foreground">יש להתחבר כדי לבצע ולשמור את האבחון.</p>
          <Link to="/login"><Button>התחבר</Button></Link>
        </div>
      </AppShell>
    );
  }
  if (beqaAccess === false) {
    return (
      <AppShell requireAuth={false}>
        <div dir="rtl" className="mx-auto max-w-md py-12 text-center space-y-4">
          <div className="text-5xl">🔒</div>
          <h1 className="text-2xl font-bold">האבחון נעול</h1>
          <p>האבחון המקצועי המאוחד זמין בתשלום של 1,200 ₪.</p>
          <Link to="/community"><Button>📩 פנה להנהלה</Button></Link>
        </div>
      </AppShell>
    );
  }

  // ---- render ----
  return (
    <AppShell requireAuth={false}>
      <div dir="rtl" className="mx-auto max-w-6xl py-6 space-y-4">
        {phase === "welcome" && <Welcome onStart={() => setPhase("consent")} />}

        {phase === "consent" && user && (
          <BiometricConsentScreen studentId={user.id} onGranted={requestCameraAndStart} />
        )}

        {phase === "language" && <LanguageChooser onPick={chooseLanguage} videoRef={videoRef} />}

        {(phase === "calibration" || phase === "questions" || phase === "pressure") && (
          <div className="grid gap-4 md:grid-cols-[1fr,1.4fr]">
            {/* LEFT: live monitor */}
            <LiveMonitor videoRef={videoRef} bpm={bpm} hrv={hrv} emotion={emotion} />

            {/* RIGHT: phase content */}
            <Card className="border-amber-500/30">
              <CardContent className="p-6 space-y-4">
                {phase === "calibration" && (
                  <CalibrationStep
                    left={calibLeft}
                    bpm={bpm}
                    onSkip={() => {
                      const avg = calibBpms.current.length
                        ? Math.round(calibBpms.current.reduce((a, b) => a + b, 0) / calibBpms.current.length)
                        : bpm ?? 72;
                      setBaselineHr(avg);
                      setPhase("questions");
                    }}
                  />
                )}
                {phase === "questions" && questions[qIdx] && lang && (
                  <QuestionCard
                    q={questions[qIdx]}
                    lang={lang}
                    idx={qIdx}
                    total={questions.length}
                    onPick={pickAnswer}
                    onRepeat={repeatTTS}
                  />
                )}
                {phase === "pressure" && pressureQ && lang && (
                  <PressureCard
                    q={pressureQ}
                    lang={lang}
                    left={pressureLeft}
                    onPick={pickAnswer}
                    onRepeat={repeatTTS}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {phase === "results" && done && <Results onReset={reset} />}
      </div>
    </AppShell>
  );
}

// ---------------- sub-components ----------------

function Welcome({ onStart }: { onStart: () => void }) {
  return (
    <div className="mx-auto max-w-xl text-center space-y-6 py-10">
      <div className="text-6xl">🧠</div>
      <h1 className="text-3xl font-bold">אבחון מקצועי מאוחד</h1>
      <p className="text-muted-foreground">
        מערכת אבחון משולבת: פסיכולוגי + ביומטרי + ניתוח פנים.
        <br />משך: ~7 דקות. נדרשת מצלמה.
      </p>
      <div className="grid grid-cols-3 gap-3 text-xs">
        <div className="rounded-xl border p-3"><Brain className="mx-auto mb-1 h-5 w-5 text-amber-500"/>פסיכולוגי</div>
        <div className="rounded-xl border p-3"><Heart className="mx-auto mb-1 h-5 w-5 text-rose-500"/>דופק (rPPG)</div>
        <div className="rounded-xl border p-3"><Camera className="mx-auto mb-1 h-5 w-5 text-emerald-500"/>פנים</div>
      </div>
      <Button size="lg" onClick={onStart} className="w-full bg-amber-500 hover:bg-amber-600 text-black">
        <Camera className="me-2 h-4 w-4" /> אפשר מצלמה והתחל
      </Button>
    </div>
  );
}

function LanguageChooser({
  onPick, videoRef,
}: { onPick: (c: DiagDisplayLanguage) => void; videoRef: React.RefObject<HTMLVideoElement | null> }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-2xl border bg-black/60 p-3">
        <video ref={videoRef} className="w-full rounded-xl aspect-video object-cover" />
        <p className="mt-2 text-xs text-center text-muted-foreground">תצוגה מקדימה — המצלמה פעילה</p>
      </div>
      <div className="space-y-3">
        <h2 className="text-xl font-bold">בחר שפה</h2>
        {DIAG_LANGUAGES.map((c) => (
          <Button key={c} onClick={() => onPick(c)} size="lg" variant="outline"
                  className="h-20 w-full text-xl font-bold hover:bg-amber-500/10 hover:border-amber-500">
            {LANGUAGE_LABEL[c]}
          </Button>
        ))}
      </div>
    </div>
  );
}

function LiveMonitor({
  videoRef, bpm, hrv, emotion,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  bpm: number | null; hrv: number | null; emotion: FaceEmotion | null;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-amber-500/30 bg-black/80 p-2">
        <video ref={videoRef} className="w-full rounded-xl aspect-video object-cover" />
      </div>
      <Card className="border-amber-500/30">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm flex items-center gap-1"><Heart className="h-4 w-4 text-rose-500"/>דופק</span>
            <span className="text-2xl font-mono font-bold text-rose-500">{bpm ?? "--"} <span className="text-xs">BPM</span></span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1"><Activity className="h-4 w-4 text-blue-400"/>HRV</span>
            <span className="font-mono">{hrv ?? "--"} ms</span>
          </div>
          <div className="pt-2 border-t space-y-2">
            <Meter label="פוקוס" value={emotion?.focus ?? 0} color="bg-emerald-500" />
            <Meter label="חרדה" value={emotion?.anxiety ?? 0} color="bg-rose-500" />
            <Meter label="ביטחון" value={emotion?.confidence ?? 0} color="bg-amber-500" />
            <Meter label="בלבול" value={emotion?.confusion ?? 0} color="bg-purple-500" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Meter({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1"><span>{label}</span><span className="font-mono">{Math.round(value * 100)}%</span></div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${Math.round(value * 100)}%` }} />
      </div>
    </div>
  );
}

function CalibrationStep({ left, bpm, onSkip }: { left: number; bpm: number | null; onSkip: () => void }) {
  const pct = ((CALIBRATION_SECONDS - left) / CALIBRATION_SECONDS) * 100;
  return (
    <div className="text-center space-y-4 py-6">
      <Badge className="bg-amber-500 text-black">שלב 1 — כיול</Badge>
      <h2 className="text-2xl font-bold">שב בנוחות. הסתכל על המצלמה.</h2>
      <p className="text-muted-foreground">מודד דופק בסיס למשך 30 שניות</p>
      <div className="text-6xl font-mono font-bold text-amber-500">{left}s</div>
      <Progress value={pct} className="h-3" />
      <p className="text-xs text-muted-foreground">דופק נוכחי: {bpm ?? "--"} BPM</p>
      {bpm != null && (
        <Button variant="outline" size="sm" onClick={onSkip}>דלג — יש לי דופק יציב</Button>
      )}
    </div>
  );
}

function QuestionCard({
  q, lang, idx, total, onPick, onRepeat,
}: {
  q: DiagQuestion; lang: DiagDisplayLanguage; idx: number; total: number;
  onPick: (optionIndex: number) => void; onRepeat: () => void;
}) {
  const tts = ttsTextFor(q, lang);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">שאלה {idx + 1} מתוך {total}</span>
        <span>{LANGUAGE_LABEL[lang]}</span>
      </div>
      <Progress value={(idx / total) * 100} className="h-2" />
      <div className="space-y-2">
        <div className="flex items-start gap-2">
          <Button variant="ghost" size="icon" onClick={onRepeat} className="shrink-0">
            <Volume2 className="h-5 w-5 text-amber-500" />
          </Button>
          <div className="space-y-1">
            <div className="text-xl font-bold leading-snug">{q.text.he}</div>
            {tts !== q.text.he && (
              <div className="text-sm text-muted-foreground" lang={lang}>
                {tts}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="grid gap-2">
        {q.options.map((opt, i) => (
          <Button key={i} onClick={() => onPick(i)} variant="outline" size="lg"
                  className="h-auto min-h-14 whitespace-normal text-start justify-start text-base font-medium py-3 px-4 hover:bg-amber-500/10 hover:border-amber-500">
            <span className="me-2 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold">
              {String.fromCharCode(1488 + i)}
            </span>
            <span>{opt.he}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}

function PressureCard({
  q, lang, left, onPick, onRepeat,
}: {
  q: DiagQuestion; lang: DiagDisplayLanguage; left: number;
  onPick: (optionIndex: number) => void; onRepeat: () => void;
}) {
  const tts = ttsTextFor(q, lang);
  const pct = (left / PRESSURE_SECONDS) * 100;
  return (
    <div className="space-y-4">
      <Badge variant="destructive">⚡ תרחיש לחץ — {left}s</Badge>
      <Progress value={pct} className="h-2" />
      <div className="flex items-start gap-2">
        <Button variant="ghost" size="icon" onClick={onRepeat} className="shrink-0">
          <Volume2 className="h-5 w-5 text-rose-500" />
        </Button>
        <div className="space-y-1">
          <div className="text-xl font-bold leading-snug">{q.text.he}</div>
          {tts !== q.text.he && (
            <div className="text-sm text-muted-foreground" lang={lang}>{tts}</div>
          )}
        </div>
      </div>
      <div className="grid gap-2">
        {q.options.map((opt, i) => (
          <Button key={i} onClick={() => onPick(i)} variant="outline" size="lg"
                  className="h-auto min-h-14 whitespace-normal text-start justify-start text-base font-medium py-3 px-4 hover:bg-rose-500/10 hover:border-rose-500">
            <span className="me-2 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold">
              {String.fromCharCode(1488 + i)}
            </span>
            <span>{opt.he}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}

function Results({ onReset }: { onReset: () => void }) {
  return (
    <div className="mx-auto max-w-md space-y-4 py-10 text-center">
      <Card className="border-gold/40">
        <CardContent className="space-y-3 p-8">
          <div className="text-5xl">✓</div>
          <h2 className="text-2xl font-bold">האבחון הושלם</h2>
          <p className="text-sm text-muted-foreground">
            תודה. התוצאה נשמרה לבעלים בלבד. אין ציון במסך זה.
          </p>
        </CardContent>
      </Card>
      <div className="flex flex-col gap-2">
        <Button onClick={onReset} className="bg-amber-500 text-black hover:bg-amber-600">
          <RotateCcw className="me-2 h-4 w-4" />אבחון חדש
        </Button>
        <Link to="/dashboard"><Button variant="outline" className="w-full">חזרה לדשבורד</Button></Link>
      </div>
    </div>
  );
}
