import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, BarChart, Bar } from "recharts";
import { Volume2, Heart, Camera, Activity, Brain, Trophy, Download, RotateCcw } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { createTTS, createFaceAnalysis, createRPPG, USE_REAL_APIS } from "@/lib/diagnostics/config";
import type { TTSProvider, FaceAnalysisProvider, RPPGProvider, FaceEmotion } from "@/lib/diagnostics/interfaces";
import { BiometricConsentScreen, hasGrantedBiometricConsent } from "@/components/diagnostics/BiometricConsentScreen";
import {
  questionsFor, ttsTextFor, COMMUNITY_LABEL, COMMUNITY_TTS_LANG,
  type Community, type DiagQuestion,
} from "@/lib/diagnostics/questions";

export const Route = createFileRoute("/diagnostics")({
  head: () => ({ meta: [{ title: "אבחון מקצועי מאוחד — Haile Drive AI" }] }),
  component: DiagnosticsPage,
});

type Phase = "welcome" | "consent" | "community" | "calibration" | "questions" | "pressure" | "results";

type AnswerRow = {
  qId: string;
  score: number;
  rtMs: number;
  bpmAtAnswer: number | null;
  emotionAtAnswer: FaceEmotion | null;
};

type BpmPoint = { t: number; bpm: number; hrv: number };
type EmoPoint = { t: number; anxiety: number; focus: number; confidence: number; confusion: number };

const CALIBRATION_SECONDS = 30;
const PRESSURE_SECONDS = 20;

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
  const [community, setCommunity] = useState<Community | null>(null);
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
    () => (community ? questionsFor(community).filter((q) => q.id !== "qp") : []),
    [community],
  );
  const pressureQ = useMemo<DiagQuestion | null>(
    () => (community ? questionsFor(community).find((q) => q.id === "qp") ?? null : null),
    [community],
  );

  // Final result
  const [final, setFinal] = useState<null | {
    psychological: number;
    biometric: number;
    faceScore: number;
    beqa: number;
    rec: { letter: "A" | "B" | "C"; label: string; color: string; emoji: string };
    insights: string[];
  }>(null);

  // ---- BEQA gate ----
  useEffect(() => {
    if (!user) { setBeqaAccess(null); return; }
    (async () => {
      const { data } = await supabase
        .from("candidates")
        .select("beqa_access")
        .or(`id.eq.${user.id},email.eq.${user.email ?? ""}`)
        .maybeSingle();
      setBeqaAccess(!!data?.beqa_access);
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
      setPhase("community");
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

  function chooseCommunity(c: Community) {
    setCommunity(c);
    startTsRef.current = Date.now();
    bpmSeries.current = []; emoSeries.current = []; calibBpms.current = [];
    setPhase("calibration");
    setCalibLeft(CALIBRATION_SECONDS);
    ttsRef.current?.speak(
      c === "russian" ? "Сядь удобно. Смотри в камеру. 30 секунд." :
      c === "ethiopian" ? "በምቾት ቁጭ በል። ካሜራውን ተመልከት። 30 ሰከንዶች።" :
      "שב בנוחות. הסתכל על המצלמה. 30 שניות.",
      COMMUNITY_TTS_LANG[c],
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
    if (phase !== "questions" || !community || !questions[qIdx]) return;
    questionShownAt.current = Date.now();
    const q = questions[qIdx];
    ttsRef.current?.speak(ttsTextFor(q, community), COMMUNITY_TTS_LANG[community]);
  }, [phase, qIdx, community, questions]);

  function repeatTTS() {
    if (!community) return;
    const q = phase === "pressure" ? pressureQ : questions[qIdx];
    if (q) ttsRef.current?.speak(ttsTextFor(q, community), COMMUNITY_TTS_LANG[community]);
  }

  async function pickAnswer(opt: { score: number }) {
    const q = phase === "pressure" ? pressureQ : questions[qIdx];
    if (!q) return;
    const row: AnswerRow = {
      qId: q.id,
      score: opt.score,
      rtMs: Date.now() - questionShownAt.current,
      bpmAtAnswer: bpm,
      emotionAtAnswer: emotion,
    };
    const next = [...answers, row];
    setAnswers(next);

    // log raw biometric (best-effort)
    if (user) {
      supabase.from("raw_biometric_log").insert({
        student_id: user.id,
        session_id: user.id, // session row inserted at finish; use student id as grouping fallback
        event_type: "answer_submitted",
        bpm, hrv,
        payload: { q: q.id, score: opt.score, rt_ms: row.rtMs, emotion: emotion ? { ...emotion } : null } as any,
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
        if (community && pressureQ) {
          ttsRef.current?.speak(ttsTextFor(pressureQ, community), COMMUNITY_TTS_LANG[community]);
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
            score: 1,
            rtMs: Date.now() - questionShownAt.current,
            bpmAtAnswer: bpm,
            emotionAtAnswer: emotion,
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
    // psychological avg (1-4 → 0-100)
    const psychAvg = allAnswers.reduce((a, b) => a + b.score, 0) / Math.max(1, allAnswers.length);
    const psychological = (psychAvg / 4) * 100;

    // biometric: accuracy (proxy: how many ≥3) + stability (baseline vs pressure)
    const accuracy = (allAnswers.filter((a) => a.score >= 3).length / Math.max(1, allAnswers.length)) * 100;
    const sHr = pressureBpms.current.length
      ? Math.round(pressureBpms.current.reduce((a, b) => a + b, 0) / pressureBpms.current.length)
      : bpm ?? baselineHr ?? 72;
    setStressHr(sHr);
    const drift = baselineHr ? Math.abs(sHr - baselineHr) / baselineHr : 0;
    const stability = Math.max(0, 1 - drift) * 100;
    const biometric = accuracy * 0.6 + stability * 0.4;

    // face score: focus - anxiety, normalized to 0-100
    const emos = emoSeries.current;
    const avg = (k: keyof EmoPoint) =>
      emos.length ? emos.reduce((a, b) => a + (b[k] as number), 0) / emos.length : 0;
    const focusAvg = avg("focus");
    const anxietyAvg = avg("anxiety");
    const faceScore = Math.max(0, Math.min(100, ((focusAvg - anxietyAvg) + 1) / 2 * 100));

    const beqa = psychological * 0.5 + biometric * 0.3 + faceScore * 0.2;

    const rec = beqa >= 75
      ? { letter: "A" as const, label: "מומלץ מאוד להמשך תהליך", color: "text-emerald-500", emoji: "🟢" }
      : beqa >= 55
      ? { letter: "B" as const, label: "מומלץ ראיון נוסף", color: "text-amber-500", emoji: "🟡" }
      : { letter: "C" as const, label: "לא מומלץ כרגע", color: "text-red-500", emoji: "🔴" };

    // generate insights
    const insights: string[] = [];
    const hardestQ = allAnswers
      .map((a, i) => ({ a, i, anxiety: a.emotionAtAnswer?.anxiety ?? 0 }))
      .sort((x, y) => y.anxiety - x.anxiety)[0];
    if (hardestQ && hardestQ.anxiety > 0.5) {
      insights.push(`שאלה ${hardestQ.i + 1} גרמה לחרדה גבוהה — מומלץ לחזק את הנושא.`);
    }
    if (drift > 0.15) insights.push(`הדופק עלה משמעותית תחת לחץ (${baselineHr}→${sHr} BPM) — תרגול נשימה יסייע.`);
    if (anxietyAvg > 0.5) insights.push("רמת חרדה כללית גבוהה — מומלץ ראיון רגוע נוסף.");
    if (focusAvg > 0.7) insights.push("ריכוז גבוה לאורך הבדיקה — נכס לתפקיד נהג.");
    if (insights.length === 0) insights.push("ביצועים יציבים — אין דגלים אדומים.");

    const result = { psychological, biometric, faceScore, beqa, rec, insights };
    setFinal(result);

    // persist
    if (user && community) {
      // Simple, robust scoring per spec — guarantees a saved score even if biometric streams are absent.
      const answersMap: Record<string, number> = {};
      for (const a of allAnswers) answersMap[a.qId] = a.score;
      const values = Object.values(answersMap);
      const avgScore = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      const finalScore = Math.round((avgScore / 4.0) * 100 * 10) / 10;
      const recommendation = finalScore >= 80 ? "A" : finalScore >= 60 ? "B" : "C";

      const { error } = await supabase.from("beqa_diagnostic_sessions").insert({
        student_id: user.id,
        assessment_type: "unified",
        community_type: community,
        answers: answersMap as any,
        psychological_score: Math.round(avgScore * 100) / 100,
        accuracy_score: finalScore,
        final_beqa_score: finalScore,
        recommendation,
        baseline_hr: baselineHr,
        stress_hr: sHr,
        end_time: new Date().toISOString(),
        metadata: {
          version: "unified-v2",
          providers: USE_REAL_APIS,
          biometric_score: Math.round(biometric * 10) / 10,
          face_score: Math.round(faceScore * 10) / 10,
          stability: Math.round(stability * 10) / 10,
          computed_beqa: Math.round(beqa * 10) / 10,
          bpm_series: bpmSeries.current.slice(-200),
          emotion_series: emoSeries.current.slice(-200),
          insights,
        } as any,
      });
      if (error) {
        console.error("save failed", error);
        toast.error("שמירת האבחון נכשלה: " + error.message);
      } else {
        toast.success("האבחון נשמר בהצלחה");
      }
    }


    setPhase("results");
  }

  function reset() {
    cleanup();
    setPhase("welcome");
    setCommunity(null);
    setAnswers([]);
    setQIdx(0);
    setFinal(null);
    setBpm(null); setHrv(null); setEmotion(null);
    setBaselineHr(null); setStressHr(null);
    bpmSeries.current = []; emoSeries.current = [];
  }

  function downloadJSON() {
    if (!final) return;
    const data = {
      community, baselineHr, stressHr, answers, final,
      bpm_series: bpmSeries.current, emotion_series: emoSeries.current,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `diagnostic-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
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

        {phase === "community" && <CommunityChooser onPick={chooseCommunity} videoRef={videoRef} />}

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
                {phase === "questions" && questions[qIdx] && community && (
                  <QuestionCard
                    q={questions[qIdx]}
                    community={community}
                    idx={qIdx}
                    total={questions.length}
                    onPick={pickAnswer}
                    onRepeat={repeatTTS}
                  />
                )}
                {phase === "pressure" && pressureQ && community && (
                  <PressureCard
                    q={pressureQ}
                    community={community}
                    left={pressureLeft}
                    onPick={pickAnswer}
                    onRepeat={repeatTTS}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {phase === "results" && final && (
          <Results
            final={final}
            baselineHr={baselineHr}
            stressHr={stressHr}
            bpmSeries={bpmSeries.current}
            emoSeries={emoSeries.current}
            onReset={reset}
            onDownload={downloadJSON}
          />
        )}
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

function CommunityChooser({
  onPick, videoRef,
}: { onPick: (c: Community) => void; videoRef: React.RefObject<HTMLVideoElement | null> }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-2xl border bg-black/60 p-3">
        <video ref={videoRef} className="w-full rounded-xl aspect-video object-cover" />
        <p className="mt-2 text-xs text-center text-muted-foreground">תצוגה מקדימה — המצלמה פעילה</p>
      </div>
      <div className="space-y-3">
        <h2 className="text-xl font-bold">בחר את הקהילה שלך</h2>
        {(["ethiopian", "russian", "manashe"] as Community[]).map((c) => (
          <Button key={c} onClick={() => onPick(c)} size="lg" variant="outline"
                  className="h-20 w-full text-xl font-bold hover:bg-amber-500/10 hover:border-amber-500">
            {COMMUNITY_LABEL[c]}
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
  q, community, idx, total, onPick, onRepeat,
}: {
  q: DiagQuestion; community: Community; idx: number; total: number;
  onPick: (opt: { score: number }) => void; onRepeat: () => void;
}) {
  const tts = ttsTextFor(q, community);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">שאלה {idx + 1} מתוך {total}</span>
        <span>{COMMUNITY_LABEL[community]}</span>
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
              <div className="text-sm text-muted-foreground" lang={community === "ethiopian" ? "am" : "ru"}>
                {tts}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="grid gap-2">
        {q.options.map((opt, i) => (
          <Button key={i} onClick={() => onPick(opt)} variant="outline" size="lg"
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
  q, community, left, onPick, onRepeat,
}: {
  q: DiagQuestion; community: Community; left: number;
  onPick: (opt: { score: number }) => void; onRepeat: () => void;
}) {
  const tts = ttsTextFor(q, community);
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
            <div className="text-sm text-muted-foreground" lang={community === "ethiopian" ? "am" : "ru"}>{tts}</div>
          )}
        </div>
      </div>
      <div className="grid gap-2">
        {q.options.map((opt, i) => (
          <Button key={i} onClick={() => onPick(opt)} variant="outline" size="lg"
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

function Results({
  final, baselineHr, stressHr, bpmSeries, emoSeries, onReset, onDownload,
}: {
  final: NonNullable<ReturnType<typeof useState<any>>[0]>;
  baselineHr: number | null; stressHr: number | null;
  bpmSeries: BpmPoint[]; emoSeries: EmoPoint[];
  onReset: () => void; onDownload: () => void;
}) {
  return (
    <div className="space-y-4">
      <Card className="border-amber-500/40">
        <CardContent className="p-6 text-center space-y-3">
          <div className="text-6xl">{final.rec.emoji}</div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">ציון BEQA סופי</div>
          <div className={`text-7xl font-black ${final.rec.color}`}>{final.beqa.toFixed(1)}</div>
          <div className="text-2xl font-bold">מועמד {final.rec.letter}</div>
          <p className="text-muted-foreground">{final.rec.label}</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <ScoreCard label="פסיכולוגי (50%)" score={final.psychological} icon={<Brain className="h-5 w-5"/>} />
        <ScoreCard label="ביומטרי (30%)" score={final.biometric} icon={<Heart className="h-5 w-5"/>} />
        <ScoreCard label="ניתוח פנים (20%)" score={final.faceScore} icon={<Camera className="h-5 w-5"/>} />
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="font-bold flex items-center gap-2"><Heart className="h-4 w-4 text-rose-500"/>דופק לאורך המבחן (בסיס: {baselineHr} → לחץ: {stressHr})</h3>
          <div className="h-48">
            <ResponsiveContainer>
              <LineChart data={bpmSeries}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2}/>
                <XAxis dataKey="t" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="bpm" stroke="#f43f5e" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="font-bold flex items-center gap-2"><Camera className="h-4 w-4 text-emerald-500"/>מצב רגשי לאורך המבחן</h3>
          <div className="h-48">
            <ResponsiveContainer>
              <LineChart data={emoSeries}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2}/>
                <XAxis dataKey="t" />
                <YAxis domain={[0, 1]} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="anxiety" stroke="#f43f5e" dot={false} />
                <Line type="monotone" dataKey="focus" stroke="#10b981" dot={false} />
                <Line type="monotone" dataKey="confidence" stroke="#f59e0b" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="font-bold flex items-center gap-2"><Trophy className="h-4 w-4 text-amber-500"/>תובנות והמלצות</h3>
          <ul className="list-disc ps-5 space-y-1 text-sm">
            {final.insights.map((s: string, i: number) => <li key={i}>{s}</li>)}
          </ul>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button onClick={onDownload} variant="outline" className="flex-1"><Download className="me-2 h-4 w-4"/>הורד דוח (JSON)</Button>
        <Button onClick={onReset} className="flex-1 bg-amber-500 text-black hover:bg-amber-600"><RotateCcw className="me-2 h-4 w-4"/>אבחון חדש</Button>
        <Link to="/dashboard" className="flex-1"><Button variant="outline" className="w-full">חזרה לדשבורד</Button></Link>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        מבוסס סימולטור מקומי. החלפה ל-Google TTS / Azure Face / Binah.ai = שינוי שורה אחת ב-src/lib/diagnostics/config.ts
      </p>
    </div>
  );
}

function ScoreCard({ label, score, icon }: { label: string; score: number; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4 text-center space-y-1">
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
        <div className="text-3xl font-bold">{score.toFixed(1)}</div>
        <Progress value={score} className="h-2" />
      </CardContent>
    </Card>
  );
}
