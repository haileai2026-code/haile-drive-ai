import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Camera, Heart, Play, Square, Activity, Brain, Trophy, Wifi } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { RppgEngine, type SignalQuality } from "@/lib/rppg-engine";
import { STRESS_QUESTIONS, STRESS_TEST_CONFIG, calculateBeqaScore } from "@/lib/beqa-questions";
import { toast } from "sonner";

export const Route = createFileRoute("/diagnostics")({
  component: DiagnosticsPage,
});

const CALIBRATION_SECONDS = 30;

type Phase = "idle" | "calibrating" | "calibrated" | "running" | "done";

type BioDiagnostics = {
  fps: number;
  meanGreen: number | null;
  brightness: number | null;
  skinRatio: number;
  motion: number | null;
  samplesInWindow: number;
};

const QUALITY_LABEL: Record<SignalQuality, string> = {
  none: "אין סיגנל",
  low: "נמוך",
  medium: "בינוני",
  high: "גבוה",
};

const QUALITY_COLOR: Record<SignalQuality, string> = {
  none: "bg-gray-500",
  low: "bg-red-500",
  medium: "bg-amber-500",
  high: "bg-emerald-500",
};

function DiagnosticsPage() {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const engineRef = useRef<RppgEngine | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const calibBpms = useRef<number[]>([]);

  const [phase, setPhase] = useState<Phase>("idle");
  const [bpm, setBpm] = useState<number | null>(null);
  const [hrv, setHrv] = useState<number | null>(null);
  const [quality, setQuality] = useState<SignalQuality>("none");
  const [faceDetected, setFaceDetected] = useState(false);
  const [calibProgress, setCalibProgress] = useState(0);
  const [baselineHr, setBaselineHr] = useState<number | null>(null);
  const [baselineHrv, setBaselineHrv] = useState<number | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [bioDiagnostics, setBioDiagnostics] = useState<BioDiagnostics>({
    fps: 0,
    meanGreen: null,
    brightness: null,
    skinRatio: 0,
    motion: null,
    samplesInWindow: 0,
  });

  // Stress test state
  const stressBpms = useRef<number[]>([]);
  const questionShownAt = useRef<number>(0);
  const questionShownBpm = useRef<number | null>(null);
  const [qIndex, setQIndex] = useState(0);
  const [qTimeLeft, setQTimeLeft] = useState(STRESS_TEST_CONFIG.timePerQuestionMs / 1000);
  const [answers, setAnswers] = useState<{ correct: boolean; rt: number; bpm: number | null }[]>([]);
  const [finalScore, setFinalScore] = useState<{
    accuracy: number;
    stability: number;
    beqa: number;
    avgRt: number;
    stressHr: number;
  } | null>(null);

  useEffect(() => {
    return () => {
      engineRef.current?.stop();
    };
  }, []);

  const requestCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480, frameRate: { ideal: 30 } },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const engine = new RppgEngine();
      engineRef.current = engine;
      engine.onSample((snap) => {
        setBpm(snap.bpm);
        setHrv(snap.hrv);
        setQuality(snap.signalQuality);
        setFaceDetected(snap.faceDetected);
        setBioDiagnostics({
          fps: snap.fps,
          meanGreen: snap.meanGreen,
          brightness: snap.brightness,
          skinRatio: snap.skinRatio,
          motion: snap.motion,
          samplesInWindow: snap.samplesInWindow,
        });
      });
      await engine.start(stream, videoRef.current!);
      setCameraReady(true);
      toast.success("המצלמה פעילה — מתחיל ניתוח rPPG");
    } catch (e) {
      console.error(e);
      toast.error("גישה למצלמה נדחתה");
    }
  };

  const startCalibration = async () => {
    if (!user || !engineRef.current) return;

    const { data, error } = await supabase
      .from("beqa_diagnostic_sessions")
      .insert({ student_id: user.id, metadata: { phase: "calibration", engine: "rppg-real-v1" } })
      .select("id")
      .single();
    if (error || !data) {
      toast.error("שגיאה ביצירת סשן");
      return;
    }
    sessionIdRef.current = data.id;
    calibBpms.current = [];
    setPhase("calibrating");

    // הקשבה לפעימות אמיתיות בלבד
    const offPulse = engineRef.current.onPulse(async (pulse) => {
      calibBpms.current.push(pulse.bpm);
      await supabase.from("raw_biometric_log").insert({
        session_id: sessionIdRef.current!,
        student_id: user.id,
        event_type: "pulse_detected",
        bpm: pulse.bpm,
        hrv: pulse.hrv,
        payload: {
          phase: "calibration",
          rr_ms: pulse.rrIntervalMs,
          signal_quality: pulse.signalQuality,
        },
      });
    });

    const startTs = Date.now();
    const interval = setInterval(async () => {
      const elapsed = (Date.now() - startTs) / 1000;
      const pct = Math.min(100, (elapsed / CALIBRATION_SECONDS) * 100);
      setCalibProgress(pct);
      if (elapsed >= CALIBRATION_SECONDS) {
        clearInterval(interval);
        offPulse();
        if (calibBpms.current.length < 5) {
          toast.error("לא הצלחנו לזהות מספיק פעימות. נסה שוב בתאורה טובה יותר.");
          setPhase("idle");
          setCalibProgress(0);
          return;
        }
        const avg = calibBpms.current.reduce((a, b) => a + b, 0) / calibBpms.current.length;
        const baseline = Math.round(avg);
        const baselineHrvVal = engineRef.current?.getSnapshot().hrv ?? null;
        setBaselineHr(baseline);
        setBaselineHrv(baselineHrvVal);
        await supabase
          .from("beqa_diagnostic_sessions")
          .update({
            baseline_hr: baseline,
            metadata: {
              phase: "calibrated",
              engine: "rppg-real-v1",
              baseline_hrv: baselineHrvVal,
              pulses_captured: calibBpms.current.length,
            },
          })
          .eq("id", sessionIdRef.current!);
        setPhase("calibrated");
        toast.success(`כיול הסתיים — דופק מנוחה: ${baseline} BPM (${calibBpms.current.length} פעימות)`);
      }
    }, 200);
  };

  const stopAll = () => {
    engineRef.current?.stop();
    engineRef.current = null;
    sessionIdRef.current = null;
    calibBpms.current = [];
    stressBpms.current = [];
    setCameraReady(false);
    setPhase("idle");
    setBpm(null);
    setHrv(null);
    setQuality("none");
    setFaceDetected(false);
    setCalibProgress(0);
    setBaselineHr(null);
    setBaselineHrv(null);
    setAnswers([]);
    setFinalScore(null);
    setBioDiagnostics({ fps: 0, meanGreen: null, brightness: null, skinRatio: 0, motion: null, samplesInWindow: 0 });
  };

  // ---- Stress test ----
  const startStressTest = () => {
    if (!engineRef.current || !user || !sessionIdRef.current) return;
    if (quality !== "high") {
      toast.error("איכות סיגנל לא מספקת. המתן לסיגנל גבוה.");
      return;
    }
    stressBpms.current = [];
    setAnswers([]);
    setQIndex(0);
    setPhase("running");

    const offStressPulse = engineRef.current.onPulse(async (pulse) => {
      stressBpms.current.push(pulse.bpm);
      await supabase.from("raw_biometric_log").insert({
        session_id: sessionIdRef.current!,
        student_id: user.id,
        event_type: "pulse_detected",
        bpm: pulse.bpm,
        hrv: pulse.hrv,
        payload: {
          phase: "stress",
          rr_ms: pulse.rrIntervalMs,
          signal_quality: pulse.signalQuality,
        },
      });
    });
    stressPulseUnsubRef.current = offStressPulse;

    showQuestion(0);
  };

  const showQuestion = async (idx: number) => {
    if (!user || !sessionIdRef.current) return;
    questionShownAt.current = Date.now();
    questionShownBpm.current = bpm;
    setQIndex(idx);
    setQTimeLeft(STRESS_TEST_CONFIG.timePerQuestionMs / 1000);
    await supabase.from("raw_biometric_log").insert({
      session_id: sessionIdRef.current,
      student_id: user.id,
      event_type: "question_shown",
      bpm,
      hrv,
      payload: { question_id: STRESS_QUESTIONS[idx].id, index: idx },
    });
  };

  useEffect(() => {
    if (phase !== "running") return;
    const t = setInterval(() => {
      setQTimeLeft((prev) => {
        if (prev <= 1) {
          submitAnswer(-1, true);
          return STRESS_TEST_CONFIG.timePerQuestionMs / 1000;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, qIndex]);

  const submitAnswer = async (selectedIdx: number, timeout = false) => {
    if (!user || !sessionIdRef.current) return;
    const q = STRESS_QUESTIONS[qIndex];
    const rt = Date.now() - questionShownAt.current;
    const correct = !timeout && selectedIdx === q.correctIndex;
    const next = [...answers, { correct, rt, bpm }];
    setAnswers(next);

    await supabase.from("raw_biometric_log").insert({
      session_id: sessionIdRef.current,
      student_id: user.id,
      event_type: "answer_submitted",
      bpm,
      hrv,
      payload: {
        question_id: q.id,
        selected: selectedIdx,
        correct,
        timeout,
        reaction_time_ms: rt,
        bpm_at_show: questionShownBpm.current,
        bpm_at_answer: bpm,
      },
    });

    if (qIndex + 1 < STRESS_QUESTIONS.length) {
      showQuestion(qIndex + 1);
    } else {
      await finishTest(next);
    }
  };

  const finishTest = async (allAnswers: { correct: boolean; rt: number; bpm: number | null }[]) => {
    if (!sessionIdRef.current || !baselineHr) return;
    const correctAnswers = allAnswers.filter((a) => a.correct).length;
    const stressHr = stressBpms.current.length
      ? Math.round(stressBpms.current.reduce((a, b) => a + b, 0) / stressBpms.current.length)
      : baselineHr;
    const avgRt = Math.round(
      allAnswers.reduce((a, b) => a + b.rt, 0) / Math.max(1, allAnswers.length),
    );
    const score = calculateBeqaScore({
      correctAnswers,
      totalQuestions: STRESS_QUESTIONS.length,
      baselineHr,
      stressHr,
    });

    await supabase
      .from("beqa_diagnostic_sessions")
      .update({
        end_time: new Date().toISOString(),
        stress_hr: stressHr,
        accuracy_score: score.accuracy,
        reaction_time_avg: avgRt,
        final_beqa_score: score.beqa,
        metadata: {
          phase: "complete",
          engine: "rppg-real-v1",
          correct: correctAnswers,
          total: STRESS_QUESTIONS.length,
          baseline_hrv: baselineHrv,
          stress_pulses_captured: stressBpms.current.length,
        },
      })
      .eq("id", sessionIdRef.current);

    setFinalScore({ ...score, avgRt, stressHr });
    setPhase("done");
    toast.success(`ציון BEQA: ${score.beqa}%`);
  };

  return (
    <AppShell>
      <div className="space-y-4" dir="rtl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">אבחון ביומטרי BEQA</h1>
            <p className="text-sm text-muted-foreground">
              עיבוד rPPG אמיתי דרך המצלמה — חילוץ דופק מערוץ ירוק
            </p>
          </div>
          <Link to="/beqa-history">
            <Button size="sm" variant="outline">היסטוריה</Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Camera className="h-4 w-4" /> תצוגת מצלמה
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative mx-auto aspect-[4/3] w-full max-w-xs overflow-hidden rounded-xl bg-black">
              <video
                ref={videoRef}
                playsInline
                muted
                className="h-full w-full object-cover"
              />
              {/* ROI overlay */}
              {cameraReady && (
                <div
                  className="pointer-events-none absolute border-2 border-emerald-400/70 rounded"
                  style={{
                    width: "25%",
                    height: "25%",
                    left: "37.5%",
                    top: "17.5%",
                  }}
                />
              )}
              {!cameraReady && (
                <div className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">
                  המצלמה כבויה
                </div>
              )}
              {cameraReady && !faceDetected && (
                <div className="absolute inset-x-0 bottom-0 bg-amber-500/90 text-white text-xs p-2 text-center">
                  מכייל… נא להישאר יציב מול המצלמה
                </div>
              )}
            </div>

            {!cameraReady ? (
              <Button onClick={requestCamera} className="w-full">
                <Camera className="ml-2 h-4 w-4" /> אפשר גישה למצלמה
              </Button>
            ) : (
              <Button onClick={stopAll} variant="outline" className="w-full">
                <Square className="ml-2 h-4 w-4" /> כבה מצלמה
              </Button>
            )}
          </CardContent>
        </Card>

        {cameraReady && (
          <>
            <div className="grid grid-cols-3 gap-2">
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Heart className="h-3 w-3 text-red-500" /> BPM
                  </div>
                  <div className="mt-1 text-xl font-bold">{bpm ?? "—"}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Activity className="h-3 w-3 text-emerald-500" /> HRV
                  </div>
                  <div className="mt-1 text-xl font-bold">{hrv ?? "—"}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Wifi className="h-3 w-3" /> איכות
                  </div>
                  <Badge className={`mt-1 ${QUALITY_COLOR[quality]} text-white text-[10px]`}>
                    {QUALITY_LABEL[quality]}
                  </Badge>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {cameraReady && (phase === "idle" || phase === "calibrating" || phase === "calibrated") && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">כיול ביומטרי (30 שניות)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {phase === "calibrating" && (
                <>
                  <Progress value={calibProgress} />
                  <p className="text-xs text-muted-foreground">
                    מנתח אות PPG מערוץ ירוק… פעימות שזוהו: {calibBpms.current.length}
                  </p>
                </>
              )}
              {baselineHr !== null && (
                <div className="rounded-lg bg-emerald-500/10 p-3 text-sm space-y-1">
                  <div>✅ דופק מנוחה: <strong>{baselineHr} BPM</strong></div>
                  {baselineHrv !== null && (
                    <div className="text-xs text-muted-foreground">
                      HRV (RMSSD): {baselineHrv} ms
                    </div>
                  )}
                </div>
              )}
              {phase === "idle" && (
                <Button
                  onClick={startCalibration}
                  className="w-full"
                  disabled={!faceDetected}
                >
                  <Play className="ml-2 h-4 w-4" />
                  {faceDetected ? "התחל כיול ביומטרי" : "ממתין לזיהוי פנים…"}
                </Button>
              )}
              {phase === "calibrated" && (
                <Button
                  onClick={startStressTest}
                  variant="default"
                  className="w-full"
                  disabled={quality !== "high"}
                >
                  <Brain className="ml-2 h-4 w-4" />
                  {quality === "high"
                    ? "התחל מבחן תחת סטרס"
                    : `ממתין לסיגנל גבוה (כעת: ${QUALITY_LABEL[quality]})`}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {phase === "running" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2">
                  <Brain className="h-4 w-4" /> שאלה {qIndex + 1}/{STRESS_QUESTIONS.length}
                </span>
                <span className="text-xs text-muted-foreground">
                  ⏱ {qTimeLeft}s · ❤ {bpm ?? "—"}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Progress
                value={(qTimeLeft / (STRESS_TEST_CONFIG.timePerQuestionMs / 1000)) * 100}
              />
              <p className="font-medium text-sm leading-relaxed">
                {STRESS_QUESTIONS[qIndex].text}
              </p>
              <div className="space-y-2">
                {STRESS_QUESTIONS[qIndex].options.map((opt, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    className="w-full justify-start text-right"
                    onClick={() => submitAnswer(i)}
                  >
                    {opt}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {phase === "done" && finalScore && (
          <Card className="border-2 border-emerald-500/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Trophy className="h-4 w-4 text-emerald-500" /> תוצאות BEQA
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-xl bg-gradient-to-br from-emerald-500/20 to-blue-500/10 p-4 text-center">
                <div className="text-xs text-muted-foreground">ציון BEQA סופי</div>
                <div className="text-4xl font-bold">{finalScore.beqa}%</div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  (Accuracy × 0.6) + (Stability × 0.4)
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg bg-muted/50 p-3">
                  <div className="text-xs text-muted-foreground">דיוק</div>
                  <div className="font-bold">{finalScore.accuracy}%</div>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <div className="text-xs text-muted-foreground">יציבות</div>
                  <div className="font-bold">{finalScore.stability}%</div>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <div className="text-xs text-muted-foreground">דופק מנוחה</div>
                  <div className="font-bold">{baselineHr} BPM</div>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <div className="text-xs text-muted-foreground">דופק תחת סטרס</div>
                  <div className="font-bold">{finalScore.stressHr} BPM</div>
                </div>
                <div className="rounded-lg bg-muted/50 p-3 col-span-2">
                  <div className="text-xs text-muted-foreground">זמן תגובה ממוצע</div>
                  <div className="font-bold">{finalScore.avgRt} ms</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
